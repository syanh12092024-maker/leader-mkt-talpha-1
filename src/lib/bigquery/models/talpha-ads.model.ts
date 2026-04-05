import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { runQuery, BQ_DATASET } from "../client";

const YAML_PATH = path.resolve(process.cwd(), "config/projects/talpha.yaml");

export interface TAlphaConfig {
    meta_ads: { access_token: string; ad_account_ids: string[] };
    poscake: { shops: Array<{ name: string; api_url: string; api_key: string; shop_id: string }>; shop_ids: string[] };
    exchange_rates: Array<{ from: string; to: string; rate: number }>;
    marketer_map?: Array<{ pos_name: string; campaign_key: string }>;
}

export interface TAlphaOrder {
    id: string;
    shop_name: string;
    ad_id: string | null;
    marketer: string;
    total_price_local: number;
    total_price_vnd: number;
    status: string;
    inserted_at: string;
    customer_name: string;
}

/**
 * ALL 21 TALPHA ad accounts use VND currency (confirmed via Meta API query).
 * Meta API returns spend already in VND → NO conversion needed (rate = 1).
 */

export class TAlphaAdsModel {
    static loadConfig(): TAlphaConfig {
        const raw = fs.readFileSync(YAML_PATH, "utf-8");
        return yaml.load(raw) as TAlphaConfig;
    }

    static getExchangeRate(currency: string): number {
        if (currency === "VND") return 1;
        const cfg = this.loadConfig();
        const rateObj = cfg.exchange_rates.find(r => r.from === currency);
        return rateObj ? rateObj.rate : 7000;
    }

    /**
     * Fetch ALL pages from Meta Ads API (handles pagination).
     * Meta API returns max ~25-500 results per page.
     */
    static async fetchAllPages(initialUrl: string): Promise<any[]> {
        const allData: any[] = [];
        let url: string | null = initialUrl;
        let pageCount = 0;

        while (url && pageCount < 20) { // Safety limit: max 20 pages
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per page
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                const json: any = await res.json();

                if (json.error) {
                    console.error("Meta API Error:", json.error.message);
                    break;
                }

                if (json.data) {
                    allData.push(...json.data);
                }

                url = json.paging?.next || null;
                pageCount++;
            } catch (e: any) {
                if (e.name === 'AbortError') {
                    console.error("Meta Ads fetch timeout, continuing...");
                } else {
                    console.error("Meta Ads fetch error:", e);
                }
                break;
            }
        }
        return allData;
    }

    /**
     * Fetch all ads (catalog) for an account — no date filter.
     * Returns: ad_id → { campaign_id, campaign_name, account_id }
     * Used to match POS orders even when the ad has no spend today.
     */
    static async fetchAdCatalog(accId: string, access_token: string): Promise<Record<string, { campaign_id: string; campaign_name: string; account_id: string }>> {
        const catalog: Record<string, { campaign_id: string; campaign_name: string; account_id: string }> = {};
        try {
            const url = `https://graph.facebook.com/v21.0/${accId}/ads?fields=id,campaign_id,campaign{id,name}&limit=500&access_token=${access_token}`;
            const rows = await this.fetchAllPages(url);
            rows.forEach((row: any) => {
                const adId = String(row.id || '');
                const campaignId = String(row.campaign_id || row.campaign?.id || '');
                const campaignName = row.campaign?.name || '';
                if (adId && campaignId) {
                    catalog[adId] = { campaign_id: campaignId, campaign_name: campaignName, account_id: accId };
                }
            });
        } catch (e) {
            console.error(`Ad catalog Error (${accId}):`, e);
        }
        return catalog;
    }

    /**
     * Fetch Meta Ads with ALL required metrics:
     * spend, purchases, conversion_value, messages, comments,
     * impressions, reach (for CPM, frequency, ROAS calculation)
     */
    static async fetchMetaAds(fromDate: string, toDate: string) {
        const cfg = this.loadConfig();
        const { access_token, ad_account_ids } = cfg.meta_ads;
        const allAds: any[] = [];
        const allCatalog: Record<string, { campaign_id: string; campaign_name: string; account_id: string }> = {};
        const timeRange = `&time_range=${encodeURIComponent(JSON.stringify({ since: fromDate, until: toDate }))}`;

        // Fields to request from Meta API
        const fields = [
            "campaign_name", "campaign_id", "ad_id", "adset_name",
            "spend", "impressions", "reach",
            "actions", "action_values",
            "cost_per_action_type"
        ].join(",");
        await Promise.all(ad_account_ids.map(async (accId) => {
            try {
                const url = `https://graph.facebook.com/v21.0/${accId}/insights?fields=${fields}&level=ad&limit=500${timeRange}&access_token=${access_token}`;

                // Fetch insights + campaign statuses + ad catalog in parallel
                const campaignStatusUrl = `https://graph.facebook.com/v21.0/${accId}/campaigns?fields=id,effective_status&limit=500&access_token=${access_token}`;
                const [rows, campaignRows, catalog] = await Promise.all([
                    this.fetchAllPages(url),
                    this.fetchAllPages(campaignStatusUrl),
                    this.fetchAdCatalog(accId, access_token),
                ]);
                // Merge catalog for this account
                Object.assign(allCatalog, catalog);

                // Build campaign_id → effective_status map
                const statusMap: Record<string, string> = {};
                campaignRows.forEach((c: any) => { statusMap[c.id] = c.effective_status || 'UNKNOWN'; });

                rows.forEach((row: any) => {
                    const actions = row.actions || [];
                    const actionValues = row.action_values || [];
                    const costPerAction = row.cost_per_action_type || [];

                    // ── Extract action metrics ──
                    const getAction = (types: string[]): number => {
                        for (const t of types) {
                            const found = actions.find((a: any) => a.action_type === t);
                            if (found) return parseInt(found.value || "0");
                        }
                        return 0;
                    };

                    const getActionValue = (types: string[]): number => {
                        for (const t of types) {
                            const found = actionValues.find((a: any) => a.action_type === t);
                            if (found) return parseFloat(found.value || "0");
                        }
                        return 0;
                    };

                    // Messages (first reply or conversation started)
                    const messages = getAction([
                        "onsite_conversion.messaging_first_reply",
                        "onsite_conversion.messaging_conversation_started_7d"
                    ]);

                    // Purchases (offsite conversions)
                    const purchases = getAction([
                        "offsite_conversion.fb_pixel_purchase",
                        "purchase",
                        "omni_purchase"
                    ]);

                    // Conversion value (revenue from purchases)
                    const conversionValue = getActionValue([
                        "offsite_conversion.fb_pixel_purchase",
                        "purchase",
                        "omni_purchase"
                    ]);

                    // Comments on post
                    const comments = getAction([
                        "comment",
                        "post_comment"
                    ]);

                    // Spend is already in VND (all accounts are VND)
                    const spend = parseFloat(row.spend || "0");
                    const impressions = parseInt(row.impressions || "0");
                    const reach = parseInt(row.reach || "0");

                    // CPM = (spend / impressions) * 1000
                    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

                    // Frequency = impressions / reach
                    const frequency = reach > 0 ? impressions / reach : 0;

                    // Cost per purchase
                    const costPerPurchase = purchases > 0 ? spend / purchases : 0;

                    // Cost per message
                    const costPerMessage = messages > 0 ? spend / messages : 0;

                    // ROAS = conversion_value / spend
                    const roas = spend > 0 ? conversionValue / spend : 0;

                    allAds.push({
                        account_id: accId,
                        campaign_id: row.campaign_id,
                        campaign_name: row.campaign_name,
                        ad_id: row.ad_id,
                        adset_name: row.adset_name || "",
                        effective_status: statusMap[row.campaign_id] || "UNKNOWN",
                        // Raw metrics from Meta
                        spend,           // Already VND
                        impressions,
                        reach,
                        messages,
                        purchases,
                        conversion_value: conversionValue,
                        comments,
                        // Calculated metrics
                        cpm,
                        frequency: parseFloat(frequency.toFixed(2)),
                        cost_per_purchase: costPerPurchase,
                        cost_per_message: costPerMessage,
                        roas: parseFloat(roas.toFixed(2)),
                        // Legacy fields (for POS matching — will be updated later)
                        orders: 0,
                        revenue_vnd: 0
                    });
                });
            } catch (e) {
                console.error(`Meta Ads Error (${accId}):`, e);
            }
        }));
        return { ads: allAds, catalog: allCatalog };
    }

    static async fetchPOSHybrid(fromDate: string, toDate: string): Promise<TAlphaOrder[]> {
        const cfg = this.loadConfig();
        const orders: TAlphaOrder[] = [];

        for (const shop of cfg.poscake.shops) {
            try {
                const currency =
                    shop.name === "UAE" ? "AED" :
                    shop.name === "Saudi" ? "SAR" :
                    shop.name === "Kuwait" ? "KWD" :
                    shop.name === "Oman" ? "OMR" :
                    shop.name === "Qatar" ? "QAR" :
                    shop.name === "Bahrain" ? "BHD" :
                    shop.name === "Japan" ? "JPY" :
                    shop.name === "Taiwan" ? "TWD" : "AED";
                const rate = this.getExchangeRate(currency);
                // JPY is a zero-decimal currency (no cents), cod is already in yen
                const ZERO_DECIMAL_CURRENCIES = ["JPY"];
                const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency);

                // ═══ PAGINATION FIX: Pancake POS API returns max 10 orders/page ═══
                // Must use page_number to iterate through all pages
                let currentPage = 1;
                let totalPages = 1;
                let shopOrderCount = 0;
                let reachedPastOrders = false;

                while (currentPage <= totalPages && !reachedPastOrders) {
                    const url = `${shop.api_url}/shops/${shop.shop_id}/orders?api_key=${shop.api_key}&page_number=${currentPage}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    totalPages = data.total_pages || 1;

                    const pageOrders = data.data || [];
                    if (pageOrders.length === 0) break;

                    for (const o of pageOrders) {
                        // POS inserted_at is UTC but lacks 'Z' suffix — append it for correct parsing
                        const rawInserted = String(o.inserted_at || '');
                        if (!rawInserted) continue;
                        const utcMs = new Date(rawInserted + 'Z').getTime();
                        const vnMs = utcMs + 7 * 60 * 60 * 1000;
                        const vn = new Date(vnMs);
                        const orderDate = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(2, '0')}`;

                        // Orders are sorted newest-first: if this order is before our date range, stop
                        if (orderDate < fromDate) {
                            reachedPastOrders = true;
                            break;
                        }

                        if (orderDate >= fromDate && orderDate <= toDate) {
                            const rawCod = o.cod || o.total_price || 0;
                            const priceLocal = isZeroDecimal ? rawCod : rawCod / 100;
                            orders.push({
                                id: String(o.id),
                                shop_name: shop.name,
                                ad_id: o.ad_id,
                                marketer: o.marketer?.name || o.marketer || "N/A",
                                total_price_local: priceLocal,
                                total_price_vnd: priceLocal * rate,
                                status: o.status,
                                inserted_at: o.inserted_at,
                                customer_name: o.shipping_address?.full_name || o.customer_name?.name || o.customer_name || "N/A"
                            });
                            shopOrderCount++;
                        }
                    }
                    currentPage++;
                    // Safety: max 200 pages (2000 orders) per shop to avoid timeout
                    if (currentPage > 200) break;
                }
                console.log(`[POS] ${shop.name}: ${shopOrderCount} orders (${fromDate} → ${toDate}), scanned ${currentPage - 1} pages`);
            } catch (e) {
                console.error(`POS API Error (${shop.name}):`, e);
            }
        }
        return orders;
    }

    // Map campaign name prefix to POS shop name
    private static MARKET_MAP: Record<string, string> = {
        "JAPAN": "Japan", "TAIWAN": "Taiwan",
        "SAUDI": "Saudi", "UAE": "UAE", "KUWAIT": "Kuwait",
        "OMAN": "Oman", "QATAR": "Qatar", "BAHRAIN": "Bahrain",
    };

    private static getCampaignMarket(campaignName: string): string | null {
        const prefix = (campaignName || "").split("/")[0]?.toUpperCase().trim();
        return this.MARKET_MAP[prefix] || null;
    }

    // Normalize tên để so sánh: bỏ dấu, lowercase, bỏ khoảng trắng thừa
    private static normalizeName(name: string): string {
        return (name || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/gi, 'd')
            .toLowerCase().trim();
    }

    static aggregate(ads: any[], orders: TAlphaOrder[]) {
        // ═══ RULE DUY NHẤT: Match POS orders by ad_id ═══
        // Pancake gắn ad_id khi KH reply quảng cáo → tạo đơn POS
        // Chỉ match khi order.ad_id trùng với ad.ad_id đang chạy
        const adIdMap = new Map<string, number>();
        ads.forEach((ad, idx) => { if (ad.ad_id) adIdMap.set(String(ad.ad_id), idx); });

        const matchedOrderIds = new Set<string>();

        orders.forEach(order => {
            const adId = order.ad_id ? String(order.ad_id) : null;
            if (!adId) return;

            if (adIdMap.has(adId)) {
                const idx = adIdMap.get(adId)!;
                ads[idx].orders += 1;
                ads[idx].revenue_vnd += order.total_price_vnd;
                matchedOrderIds.add(order.id);
            }
        });

        // Đơn không có ad_id hoặc ad_id không match → không gán (honest reporting)
        const unmatchedOrders = orders.filter(o => !matchedOrderIds.has(o.id));
        if (unmatchedOrders.length > 0) {
            const unmatchedRevenue = unmatchedOrders.reduce((s, o) => s + o.total_price_vnd, 0);
            console.log(`[POS] ${unmatchedOrders.length} orders unmatched (no ad_id) — revenue: ${unmatchedRevenue.toLocaleString()}đ`);
        }

        // ═══ Aggregate totals ═══
        const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
        const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
        const totalReach = ads.reduce((s, a) => s + a.reach, 0);
        const totalMessages = ads.reduce((s, a) => s + a.messages, 0);
        const totalPurchases = ads.reduce((s, a) => s + a.purchases, 0);
        const totalConversionValue = ads.reduce((s, a) => s + a.conversion_value, 0);
        const totalComments = ads.reduce((s, a) => s + a.comments, 0);

        // POS totals
        const posOrders = orders.length;
        const posRevenue = orders.reduce((s, o) => s + o.total_price_vnd, 0);
        const posRoas = totalSpend > 0 ? posRevenue / totalSpend : 0;

        return {
            ads,
            orders,
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_reach: totalReach,
            total_messages: totalMessages,
            total_purchases: totalPurchases,
            total_conversion_value: totalConversionValue,
            total_comments: totalComments,
            total_cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
            total_frequency: totalReach > 0 ? totalImpressions / totalReach : 0,
            total_roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
            total_cost_per_purchase: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
            total_cost_per_message: totalMessages > 0 ? totalSpend / totalMessages : 0,
            pos_orders: posOrders,
            pos_revenue: posRevenue,
            pos_roas: parseFloat(posRoas.toFixed(2)),
        };
    }
}
