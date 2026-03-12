import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { runQuery, BQ_DATASET } from "../client";

const YAML_PATH = path.resolve(process.cwd(), "../Agentic-AI-Levelup/config/projects/talpha.yaml");

export interface TAlphaConfig {
    meta_ads: { access_token: string; ad_account_ids: string[] };
    poscake: { shops: Array<{ name: string; api_url: string; api_key: string; shop_id: string }>; shop_ids: string[] };
    exchange_rates: Array<{ from: string; to: string; rate: number }>;
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

export class TAlphaAdsModel {
    static loadConfig(): TAlphaConfig {
        const raw = fs.readFileSync(YAML_PATH, "utf-8");
        return yaml.load(raw) as TAlphaConfig;
    }

    static getExchangeRate(currency: string): number {
        const cfg = this.loadConfig();
        const rateObj = cfg.exchange_rates.find(r => r.from === currency);
        return rateObj ? rateObj.rate : 7000;
    }

    static async fetchMetaAds(fromDate: string, toDate: string) {
        const cfg = this.loadConfig();
        const { access_token, ad_account_ids } = cfg.meta_ads;
        const allAds: any[] = [];
        const timeRange = `&time_range=${encodeURIComponent(JSON.stringify({ since: fromDate, until: toDate }))}`;

        await Promise.all(ad_account_ids.map(async (accId) => {
            try {
                const url = `https://graph.facebook.com/v21.0/${accId}/insights?fields=campaign_name,campaign_id,ad_id,spend,impressions,actions&level=ad${timeRange}&access_token=${access_token}`;
                const res = await fetch(url);
                const data: any = await res.json();

                (data.data || []).forEach((row: any) => {
                    const actions = row.actions || [];
                    const messages = actions.find((a: any) => a.action_type === "onsite_conversion.messaging_first_reply" || a.action_type === "onsite_conversion.messaging_conversation_started_7d")?.value || 0;
                    allAds.push({
                        account_id: accId,
                        campaign_id: row.campaign_id,
                        campaign_name: row.campaign_name,
                        ad_id: row.ad_id,
                        spend_vnd: parseFloat(row.spend || "0") * 7010, // Default to AED rate
                        messages: parseInt(messages),
                        orders: 0,
                        revenue_vnd: 0
                    });
                });
            } catch (e) {
                console.error(`Meta Ads Error (${accId}):`, e);
            }
        }));
        return allAds;
    }

    static async fetchPOSHybrid(fromDate: string, toDate: string): Promise<TAlphaOrder[]> {
        const cfg = this.loadConfig();
        const orders: TAlphaOrder[] = [];

        // Simple API fetch for current dates
        for (const shop of cfg.poscake.shops) {
            try {
                const rate = this.getExchangeRate(shop.name === "UAE" ? "AED" : shop.name === "Saudi" ? "SAR" : "KWD");
                const url = `${shop.api_url}/shops/${shop.shop_id}/orders?api_key=${shop.api_key}&limit=100`;
                const res = await fetch(url);
                const data = await res.json();

                (data.data || []).forEach((o: any) => {
                    const orderDate = String(o.inserted_at).slice(0, 10);
                    if (orderDate >= fromDate && orderDate <= toDate) {
                        const priceLocal = (o.cod || o.total_price || 0) / 100;
                        orders.push({
                            id: String(o.id),
                            shop_name: shop.name,
                            ad_id: o.ad_id,
                            marketer: o.marketer?.name || o.marketer || "N/A",
                            total_price_local: priceLocal,
                            total_price_vnd: priceLocal * rate,
                            status: o.status,
                            inserted_at: o.inserted_at,
                            customer_name: o.customer_name?.name || o.customer_name || "N/A"
                        });
                    }
                });
            } catch (e) {
                console.error(`POS API Error (${shop.name}):`, e);
            }
        }
        return orders;
    }

    static aggregate(ads: any[], orders: TAlphaOrder[]) {
        const adIdMap = new Map();
        ads.forEach((ad, idx) => { if (ad.ad_id) adIdMap.set(ad.ad_id, idx); });

        orders.forEach(order => {
            if (order.ad_id && adIdMap.has(order.ad_id)) {
                const idx = adIdMap.get(order.ad_id);
                ads[idx].orders += 1;
                ads[idx].revenue_vnd += order.total_price_vnd;
            }
        });

        return {
            ads,
            total_spend: ads.reduce((s, a) => s + a.spend_vnd, 0),
            total_revenue: orders.reduce((s, o) => s + o.total_price_vnd, 0),
            total_orders: orders.length,
            total_messages: ads.reduce((s, a) => s + a.messages, 0)
        };
    }
}
