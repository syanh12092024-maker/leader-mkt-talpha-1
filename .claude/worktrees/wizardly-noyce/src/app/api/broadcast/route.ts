import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShopConfig {
    name: string;
    api_key: string;
    shop_id: string;
}

interface FacebookConfig {
    access_token: string;
    app_id?: string;
    app_secret?: string;
}

interface ScriptGeneratorConfig {
    poscake: {
        api_url: string;
        shops: ShopConfig[];
    };
    pancake_crm?: {
        api_url: string;
        api_token: string;
    };
    meta_ads?: {
        access_token: string;
        app_id?: string;
        app_secret?: string;
    };
    facebook_messaging?: {
        app_id: string;
        user_access_token: string;
        app_secret?: string;
        page_tokens?: Record<string, string>; // pageId → access_token (trực tiếp từ config)
    };
}

interface PancakeCustomer {
    id: string;
    name: string;
    fb_id: string;
    customer_id: string;
    phone_numbers?: string[];
    conversation_link: string;
    order_count: number;
    updated_at: string;
    inserted_at: string;
    tags?: Array<{ name: string }>;
    shop_customer_addresses?: Array<{ full_address?: string }>;
}

interface CRMConversation {
    id: string;
    from: { id: string; name: string };
    from_psid: number | string;
    snippet: string;
    message_count: number;
    tags: number[];
    has_phone: boolean;
    recent_phone_numbers: Array<string | { phone_number?: string; captured?: string }>;
    updated_at: string;
    inserted_at: string;
    last_customer_interactive_at: string;
    customers: Array<{ fb_id: string; id: string; name: string }>;
    page_id: number | string;
    type: string;
}

// ─── Load config ──────────────────────────────────────────────────────────────
function loadConfig(): ScriptGeneratorConfig {
    // Load script-generator.yaml (primary)
    const configPath = path.join(process.cwd(), "config", "script-generator.yaml");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = yaml.load(raw) as ScriptGeneratorConfig;
    
    // Load talpha.yaml for Facebook credentials
    try {
        const talphaPath = path.join(process.cwd(), "config", "projects", "talpha.yaml");
        const talphaRaw = fs.readFileSync(talphaPath, "utf-8");
        const talphaConfig = yaml.load(talphaRaw) as Record<string, unknown>;
        if (talphaConfig?.meta_ads) {
            config.meta_ads = talphaConfig.meta_ads as ScriptGeneratorConfig['meta_ads'];
        }
    } catch { /* ignore if talpha.yaml not found */ }
    
    return config;
}

// ─── GET: Lấy conversations (CRM) hoặc customers (POS fallback) ─────────────
export async function GET(req: NextRequest) {
    try {
        const config = loadConfig();
        const { searchParams } = new URL(req.url);
        const shopId = searchParams.get("shopId");
        const getPages = searchParams.get("getPages") === "true";
        const pageFilter = searchParams.get("pageFilter") || "";
        const page = searchParams.get("page") || "1";
        const debugCrm = searchParams.get("debugCrm") === "true";

        // ═══ DEBUG CRM: Comprehensive Pancake API param testing ═══
        if (debugCrm && pageFilter && config.pancake_crm?.api_token) {
            const apiUrl = config.pancake_crm.api_url;
            const token = config.pancake_crm.api_token;
            const results: Array<Record<string, unknown>> = [];
            const mask = (u: string) => u.replace(token, '***');

            // --- Test 1: Default fetch (baseline) ---
            const url1 = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500`;
            const r1 = await fetch(url1);
            const d1 = await r1.json();
            const c1: CRMConversation[] = d1.conversations || [];
            const allIds1 = new Set(c1.map(c => c.id));
            results.push({
                test: "1: baseline limit=500",
                url: mask(url1),
                count: c1.length,
                firstId: c1[0]?.id,
                lastId: c1[c1.length - 1]?.id,
                responseKeys: Object.keys(d1),
                sampleFields: c1[0] ? Object.keys(c1[0]) : [],
            });

            // --- Test 2: Cursor pagination with last_conversation_id ---
            if (c1.length > 0) {
                const lastId = c1[c1.length - 1].id;
                const url2 = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&last_conversation_id=${lastId}`;
                const r2 = await fetch(url2);
                const d2 = await r2.json();
                const c2: CRMConversation[] = d2.conversations || [];
                const overlap = c2.filter(c => allIds1.has(c.id)).length;
                const newUnique = c2.length - overlap;
                results.push({
                    test: `2: cursor last_conversation_id=${lastId}`,
                    url: mask(url2),
                    count: c2.length,
                    overlap,
                    newUnique,
                    cursorWorks: newUnique > 0,
                });
            }

            // --- Test 3: Fetch conversation tags → test per-tag filtering ---
            let tagList: Array<{id: number; name: string}> = [];
            try {
                const tagUrl = `${apiUrl}/pages/${pageFilter}/conversation_tags?access_token=${token}`;
                const tagRes = await fetch(tagUrl);
                const tagData = await tagRes.json();
                tagList = (tagData.conversation_tags || []).map((t: {id: number; name: string}) => ({
                    id: Number(t.id),
                    name: String(t.name || ''),
                }));
                results.push({
                    test: "3: available tags",
                    totalTags: tagList.length,
                    tags: tagList.map(t => `[${t.id}] ${t.name}`),
                });
            } catch (err) {
                results.push({ test: "3: tags fetch failed", error: String(err) });
            }

            // --- Test 4: Filter by tag_id (test first 3 tags) ---
            for (const tag of tagList.slice(0, 3)) {
                const urlTag = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&tag_id=${tag.id}`;
                try {
                    const rTag = await fetch(urlTag);
                    const dTag = await rTag.json();
                    const cTag: CRMConversation[] = dTag.conversations || [];
                    const newFromTag = cTag.filter(c => !allIds1.has(c.id)).length;
                    results.push({
                        test: `4: tag_id=${tag.id} (${tag.name})`,
                        url: mask(urlTag),
                        count: cTag.length,
                        newVsBaseline: newFromTag,
                        tagFilterWorks: !dTag.error_code,
                    });
                } catch (err) {
                    results.push({ test: `4: tag_id=${tag.id} failed`, error: String(err) });
                }
            }

            // --- Test 5: Filter by type (inbox vs comment vs ...) ---
            for (const type of ["inbox", "comment", "livechat"]) {
                const urlType = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&type=${type}`;
                try {
                    const rType = await fetch(urlType);
                    const dType = await rType.json();
                    const cType: CRMConversation[] = dType.conversations || [];
                    const newFromType = cType.filter(c => !allIds1.has(c.id)).length;
                    results.push({
                        test: `5: type=${type}`,
                        url: mask(urlType),
                        count: cType.length,
                        newVsBaseline: newFromType,
                        typeFilterWorks: !dType.error_code,
                    });
                } catch (err) {
                    results.push({ test: `5: type=${type} failed`, error: String(err) });
                }
            }

            // --- Test 6: Filter by is_read status ---
            for (const isRead of ["true", "false"]) {
                const urlRead = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&is_read=${isRead}`;
                try {
                    const rRead = await fetch(urlRead);
                    const dRead = await rRead.json();
                    const cRead: CRMConversation[] = dRead.conversations || [];
                    results.push({
                        test: `6: is_read=${isRead}`,
                        url: mask(urlRead),
                        count: cRead.length,
                        filterWorks: !dRead.error_code,
                    });
                } catch (err) {
                    results.push({ test: `6: is_read=${isRead} failed`, error: String(err) });
                }
            }

            // --- Test 7: Search param ---
            const urlSearch = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&search=a`;
            try {
                const rSearch = await fetch(urlSearch);
                const dSearch = await rSearch.json();
                const cSearch: CRMConversation[] = dSearch.conversations || [];
                results.push({
                    test: "7: search=a",
                    url: mask(urlSearch),
                    count: cSearch.length,
                    searchWorks: !dSearch.error_code,
                });
            } catch (err) {
                results.push({ test: "7: search failed", error: String(err) });
            }

            // --- Test 8: Sort order (oldest first) ---
            const urlSort = `${apiUrl}/pages/${pageFilter}/conversations?access_token=${token}&limit=500&sort=asc`;
            try {
                const rSort = await fetch(urlSort);
                const dSort = await rSort.json();
                const cSort: CRMConversation[] = dSort.conversations || [];
                const newFromSort = cSort.filter(c => !allIds1.has(c.id)).length;
                results.push({
                    test: "8: sort=asc (oldest first)",
                    url: mask(urlSort),
                    count: cSort.length,
                    newVsBaseline: newFromSort,
                    sortWorks: cSort.length > 0 && !dSort.error_code,
                });
            } catch (err) {
                results.push({ test: "8: sort=asc failed", error: String(err) });
            }

            // --- POS: Count how many POS customers exist for comparison ---
            let posCount = 0;
            try {
                const shop = config.poscake.shops[0];
                if (shop) {
                    const posUrl = `${config.poscake.api_url}/shops/${shop.shop_id}/customers?api_key=${shop.api_key}&page=1&page_size=1`;
                    const posRes = await fetch(posUrl);
                    const posData = await posRes.json();
                    posCount = posData.total_count || posData.total || (posData.data || []).length;
                }
            } catch { /* ignore */ }

            results.push({
                test: "9: POS total customers (for reference)",
                posCustomerCount: posCount,
            });

            return NextResponse.json({
                debugCrm: true,
                pageId: pageFilter,
                crmBaseline: c1.length,
                results,
                recommendation: c1.length >= 500
                    ? "CRM is at 500 cap. Check which filters return newVsBaseline > 0 to find strategies for fetching beyond 500."
                    : `CRM returned ${c1.length} (under 500 cap). All data may already be fetched.`,
            });
        }

        if (!shopId) {
            // ─── getPages=true without shopId → fetch pages from ALL shops ───
            if (getPages) {
                try {
                    const allPages: Array<{ pageId: string; name: string; platform: string; shopName: string }> = [];
                    const seenPageIds = new Set<string>();

                    await Promise.all(config.poscake.shops.map(async (s) => {
                        try {
                            const shopRes = await fetch(
                                `${config.poscake.api_url}/shops/${s.shop_id}?api_key=${s.api_key}`
                            );
                            const shopData = await shopRes.json();
                            const shopInfo = shopData?.shop || shopData;
                            for (const p of (shopInfo?.pages || [])) {
                                const pid = String(p.id);
                                if (!seenPageIds.has(pid)) {
                                    seenPageIds.add(pid);
                                    allPages.push({
                                        pageId: pid,
                                        name: p.name || `Page ${pid}`,
                                        platform: p.platform || "facebook",
                                        shopName: s.name,
                                    });
                                }
                            }
                        } catch (err) {
                            console.error(`[broadcast] Fetch pages for shop ${s.name} error:`, err);
                        }
                    }));

                    allPages.sort((a, b) => a.name.localeCompare(b.name));
                    return NextResponse.json({ pages: allPages, shopName: "Tất cả", totalPages: allPages.length });
                } catch (err) {
                    console.error("[broadcast] All pages fetch error:", err);
                    return NextResponse.json({ pages: [], shopName: "Tất cả" });
                }
            }

            // ─── No shopId, but have pageFilter → CRM-only mode ───
            if (pageFilter && config.pancake_crm?.api_token) {
                try {
                    const crmData = await fetchCRMConversations(
                        config.pancake_crm.api_url,
                        config.pancake_crm.api_token,
                        pageFilter,
                        Number(page)
                    );
                    if (crmData) return NextResponse.json(crmData);
                    return NextResponse.json({
                        customers: [], total: 0, page: 1, totalPages: 1,
                        crmWarning: `⚠️ CRM không trả data cho page ${pageFilter}. Có thể cần đăng nhập lại Pancake.`,
                    });
                } catch (err) {
                    console.error("[broadcast] CRM-only error:", err);
                    return NextResponse.json({
                        customers: [], total: 0, page: 1, totalPages: 1,
                        crmWarning: `⚠️ CRM lỗi: ${err instanceof Error ? err.message : String(err)}`,
                    });
                }
            }

            const shops = config.poscake.shops.map((s) => ({
                name: s.name,
                shop_id: s.shop_id,
            }));
            return NextResponse.json({ shops });
        }

        const shop = config.poscake.shops.find((s) => s.shop_id === shopId);
        if (!shop) {
            return NextResponse.json({ error: `Shop ${shopId} không tồn tại` }, { status: 404 });
        }

        // If getPages=true, return list of pages for this shop
        if (getPages) {
            try {
                const shopRes = await fetch(
                    `${config.poscake.api_url}/shops/${shop.shop_id}?api_key=${shop.api_key}`
                );
                const shopData = await shopRes.json();
                const shopInfo = shopData?.shop || shopData;

                const pages = (shopInfo?.pages || []).map((p: { id: string; name?: string; platform?: string }) => ({
                    pageId: String(p.id),
                    name: p.name || `Page ${p.id}`,
                    platform: p.platform || "facebook",
                }));

                pages.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

                return NextResponse.json({ pages, shopName: shop.name, totalPages: pages.length });
            } catch (err) {
                console.error("[broadcast] Pages fetch error:", err);
                return NextResponse.json({ pages: [], shopName: shop.name });
            }
        }

        // ─── Primary: CRM Conversations (ALL who messaged) ────────────────
        // ─── Enhanced: CRM + POS merge for maximum coverage ──────────────
        let crmError: string | null = null;
        let crmResult: Record<string, unknown> | null = null;

        if (pageFilter && config.pancake_crm?.api_token) {
            try {
                crmResult = await fetchCRMConversations(
                    config.pancake_crm.api_url,
                    config.pancake_crm.api_token,
                    pageFilter,
                    Number(page)
                ) as Record<string, unknown> | null;
                if (!crmResult) {
                    crmError = `CRM không trả data cho page ${pageFilter}. Có thể cần đăng nhập lại Pancake.`;
                }
            } catch (err) {
                console.error("[broadcast] CRM error:", err);
                crmError = `CRM lỗi: ${err instanceof Error ? err.message : String(err)}`;
            }
        }

        // ─── Merge CRM + POS: bổ sung POS customers mà CRM không có ─────
        if (crmResult) {
            const crmCustomers = (crmResult.customers || []) as Array<Record<string, unknown>>;
            const crmPsids = new Set(crmCustomers.map(c => String(c.psid || '')).filter(Boolean));
            const crmPhones = new Set(crmCustomers.map(c => String(c.customerPhone || '')).filter(p => p && p !== 'has_phone'));
            const crmNames = new Set(crmCustomers.map(c => String(c.customerName || '').toLowerCase()).filter(Boolean));

            // Fetch POS data to supplement
            let posExtra: Array<Record<string, unknown>> = [];
            try {
                const posResponse = await fetchPOSCustomers(config, shop, page, pageFilter);
                const posData = await posResponse.json();
                const posCustomers = (posData.customers || []) as Array<Record<string, unknown>>;

                // Enrich CRM customers with POS data (orderCount, address)
                for (const crm of crmCustomers) {
                    const crmPhone = String(crm.customerPhone || '');
                    const crmName = String(crm.customerName || '').toLowerCase();
                    const matchedPos = posCustomers.find(pos => {
                        const posPhone = String(pos.customerPhone || '');
                        const posName = String(pos.customerName || '').toLowerCase();
                        // Match by phone or by exact name
                        if (crmPhone && posPhone && crmPhone === posPhone) return true;
                        if (crmName && posName && crmName === posName) return true;
                        return false;
                    });
                    if (matchedPos) {
                        crm.orderCount = Number(matchedPos.orderCount) || crm.orderCount;
                        if (!crm.customerPhone && matchedPos.customerPhone) {
                            crm.customerPhone = matchedPos.customerPhone;
                        }
                        if (!crm.address && matchedPos.address) {
                            crm.address = matchedPos.address;
                        }
                    }
                }

                // Add POS-only customers (those NOT in CRM)
                for (const pos of posCustomers) {
                    const posPhone = String(pos.customerPhone || '');
                    const posPsid = String(pos.psid || '');
                    const posName = String(pos.customerName || '').toLowerCase();

                    const alreadyInCrm =
                        (posPsid && crmPsids.has(posPsid)) ||
                        (posPhone && crmPhones.has(posPhone)) ||
                        (posName && crmNames.has(posName));

                    if (!alreadyInCrm && posPsid) {
                        posExtra.push({ ...pos, source: "pos" });
                    }
                }

                console.log(`[broadcast] CRM+POS merge: ${crmCustomers.length} CRM + ${posExtra.length} POS-only = ${crmCustomers.length + posExtra.length} total`);
            } catch (err) {
                console.error("[broadcast] POS supplement fetch failed (non-critical):", err);
            }

            // ─── META GRAPH API SUPPLEMENT ──────────────────────────────────
            // Lấy thêm PSID mà CRM (cap 500) + POS (chỉ khách đã mua) đều không có.
            // Đây là cách DUY NHẤT đảm bảo lấy hết khách của 1 page.
            let metaExtra: Array<Record<string, unknown>> = [];
            let metaDebug: Record<string, unknown> = {};
            const userToken = config.facebook_messaging?.user_access_token;
            if (userToken) {
                try {
                    const pageToken = await getFacebookPageToken(
                        pageFilter,
                        userToken,
                        undefined,
                        config.facebook_messaging?.page_tokens
                    );
                    if (pageToken) {
                        const metaResult = await fetchMetaConversations(pageFilter, pageToken);
                        metaDebug = {
                            metaRaw: metaResult.raw,
                            metaPages: metaResult.pages,
                            metaError: metaResult.error,
                            metaTotal: metaResult.customers.length,
                        };

                        // Build dedup set từ CRM + POS hiện có
                        const existingPsids = new Set<string>([
                            ...crmCustomers.map(c => String(c.psid || '')).filter(Boolean),
                            ...posExtra.map(c => String(c.psid || '')).filter(Boolean),
                        ]);

                        for (const meta of metaResult.customers) {
                            const mpsid = String(meta.psid || '');
                            if (mpsid && !existingPsids.has(mpsid)) {
                                metaExtra.push(meta);
                                existingPsids.add(mpsid);
                            }
                        }
                        console.log(`[broadcast] Meta supplement: +${metaExtra.length} new PSIDs (total raw=${metaResult.raw})`);
                    } else {
                        metaDebug = { metaError: "No page token resolved" };
                    }
                } catch (err) {
                    console.error("[broadcast] Meta Graph fetch failed (non-critical):", err);
                    metaDebug = { metaError: err instanceof Error ? err.message : String(err) };
                }
            } else {
                metaDebug = { metaError: "facebook_messaging.user_access_token not configured" };
            }

            const mergedCustomers = [...crmCustomers, ...posExtra, ...metaExtra];
            return NextResponse.json({
                ...crmResult,
                customers: mergedCustomers,
                total: mergedCustomers.length,
                debug: {
                    ...(crmResult.debug as Record<string, unknown> || {}),
                    posExtra: posExtra.length,
                    metaExtra: metaExtra.length,
                    mergedTotal: mergedCustomers.length,
                    crmOnly: crmCustomers.length,
                    ...metaDebug,
                },
            });
        }

        // ─── Fallback: POS + Meta (CRM failed) ───────────────────────────
        const posResponse = await fetchPOSCustomers(config, shop, page, pageFilter);
        if (crmError) {
            const posData = await posResponse.json();
            const posCustomers = (posData.customers || []) as Array<Record<string, unknown>>;

            // Vẫn cố lấy Meta để bù cho CRM lỗi
            let metaCustomers: Array<Record<string, unknown>> = [];
            const userToken = config.facebook_messaging?.user_access_token;
            if (userToken && pageFilter) {
                try {
                    const pageToken = await getFacebookPageToken(
                        pageFilter, userToken, undefined, config.facebook_messaging?.page_tokens
                    );
                    if (pageToken) {
                        const metaResult = await fetchMetaConversations(pageFilter, pageToken);
                        const posPsids = new Set(posCustomers.map(c => String(c.psid || '')).filter(Boolean));
                        metaCustomers = metaResult.customers.filter(m => {
                            const mp = String(m.psid || '');
                            return mp && !posPsids.has(mp);
                        });
                    }
                } catch (err) {
                    console.error("[broadcast] Meta fallback failed:", err);
                }
            }

            const merged = [...posCustomers, ...metaCustomers];
            return NextResponse.json({
                ...posData,
                customers: merged,
                total: merged.length,
                crmWarning: `⚠️ ${crmError} — Đang dùng POS (${posCustomers.length}) + Meta Graph (${metaCustomers.length}). Đăng nhập lại Pancake CRM để lấy thêm tag/snippet.`,
            });
        }
        return posResponse;
    } catch (error: unknown) {
        console.error("[broadcast] GET Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ─── CRM Conversations fetcher ───────────────────────────────────────────────
// ═══ Multi-strategy fetch: vượt giới hạn 500 bằng tag-based + cursor splitting ═══

async function fetchCRMBatch(
    apiUrl: string, token: string, pageId: string, extraParams: string = ""
): Promise<{ conversations: CRMConversation[]; error?: string }> {
    const url = `${apiUrl}/pages/${pageId}/conversations?access_token=${token}&limit=500${extraParams}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error_code) return { conversations: [], error: `[${data.error_code}] ${data.message}` };
        return { conversations: data.conversations || [] };
    } catch (err) {
        return { conversations: [], error: String(err) };
    }
}

async function fetchCRMConversations(
    apiUrl: string,
    token: string,
    pageId: string,
    _page: number
): Promise<object | null> {
    const seenIds = new Set<string>();
    const allConversations: CRMConversation[] = [];
    const strategyLog: Array<{ strategy: string; fetched: number; new: number }> = [];

    const addBatch = (batch: CRMConversation[], strategy: string) => {
        let newCount = 0;
        for (const c of batch) {
            if (c.id && !seenIds.has(String(c.id))) {
                seenIds.add(String(c.id));
                allConversations.push(c);
                newCount++;
            }
        }
        strategyLog.push({ strategy, fetched: batch.length, new: newCount });
        console.log(`[broadcast] CRM [${strategy}]: fetched=${batch.length}, new=${newCount}, total=${allConversations.length}`);
        return newCount;
    };

    // ═══ STRATEGY 1: Default fetch (newest 500) ═══
    const batch1 = await fetchCRMBatch(apiUrl, token, pageId);
    if (batch1.error) {
        console.error(`[broadcast] CRM Error: ${batch1.error}`);
        return null;
    }
    addBatch(batch1.conversations, "default");

    // Only try additional strategies if we hit the 500 cap
    if (batch1.conversations.length >= 500) {
        // ═══ STRATEGY 2: TIME-WINDOWED FETCHING (most reliable bypass for 500 cap) ═══
        // Mỗi window là 1 query độc lập → Pancake trả 500 mới cho từng khoảng thời gian.
        // Dùng updated_at cuối cùng của batch trước làm mốc để cuốn ngược về quá khứ.
        const oldest = batch1.conversations[batch1.conversations.length - 1];
        const oldestTs = oldest?.updated_at || oldest?.inserted_at || "";
        const oldestEpoch = oldestTs ? Math.floor(new Date(oldestTs).getTime() / 1000) : 0;

        if (oldestEpoch > 0) {
            // Try multiple Pancake timestamp param naming conventions
            // Pancake hay dùng `until` (Unix epoch seconds) — fetch những cái CŨ HƠN mốc này
            const paramVariants = [
                (ts: number) => `&until=${ts}`,
                (ts: number) => `&to_time=${ts}`,
                (ts: number) => `&end_time=${ts}`,
                (ts: number) => `&before=${ts}`,
                (ts: number) => `&max_updated_at=${ts}`,
            ];

            // Find which param the API actually honors by checking if response is different
            let workingParam: ((ts: number) => string) | null = null;
            for (const variant of paramVariants) {
                const probe = await fetchCRMBatch(apiUrl, token, pageId, variant(oldestEpoch));
                const probeIds = new Set(probe.conversations.map(c => String(c.id)));
                // If probe returns conversations NOT in batch1, this param works
                const overlap = batch1.conversations.filter(c => probeIds.has(String(c.id))).length;
                const newOnes = probe.conversations.length - overlap;
                if (newOnes > 0) {
                    workingParam = variant;
                    addBatch(probe.conversations, `time_probe:${variant.toString().match(/&\w+/)?.[0] || 'unknown'}`);
                    break;
                }
            }

            // If we found a working time param, walk backwards through history
            if (workingParam) {
                let cursorTs = oldestEpoch;
                let walkAttempts = 0;
                const maxWalks = 20; // up to 20 windows × ~500 = 10k conversations
                while (walkAttempts < maxWalks) {
                    const walkBatch = await fetchCRMBatch(apiUrl, token, pageId, workingParam(cursorTs - 1));
                    if (walkBatch.conversations.length === 0) break;
                    const newCount = addBatch(walkBatch.conversations, `time_walk_${walkAttempts + 1}`);
                    if (newCount === 0) break;
                    const lastConv = walkBatch.conversations[walkBatch.conversations.length - 1];
                    const lastTs = lastConv?.updated_at || lastConv?.inserted_at;
                    const newCursor = lastTs ? Math.floor(new Date(lastTs).getTime() / 1000) : 0;
                    if (!newCursor || newCursor >= cursorTs) break; // not making progress
                    cursorTs = newCursor;
                    walkAttempts++;
                }
            }
        }

        // ═══ STRATEGY 3: Per-tag filtering ═══
        // Each tag returns up to 500 conversations → different subset
        let tagList: Array<{ id: number; name: string }> = [];
        try {
            const tagUrl = `${apiUrl}/pages/${pageId}/conversation_tags?access_token=${token}`;
            const tagRes = await fetch(tagUrl);
            const tagData = await tagRes.json();
            tagList = (tagData.conversation_tags || []).map((t: { id: number; name: string }) => ({
                id: Number(t.id),
                name: String(t.name || ''),
            }));
        } catch { /* ignore */ }

        for (const tag of tagList) {
            const tagBatch = await fetchCRMBatch(apiUrl, token, pageId, `&tag_id=${tag.id}`);
            if (tagBatch.conversations.length > 0) {
                addBatch(tagBatch.conversations, `tag:${tag.name}`);
            }
        }

        // ═══ STRATEGY 4: Type-based filtering (inbox vs comment) ═══
        for (const type of ["inbox", "comment"]) {
            const typeBatch = await fetchCRMBatch(apiUrl, token, pageId, `&type=${type}`);
            if (typeBatch.conversations.length > 0) {
                addBatch(typeBatch.conversations, `type:${type}`);
            }
        }

        // ═══ STRATEGY 5: is_read filtering ═══
        for (const isRead of ["true", "false"]) {
            const readBatch = await fetchCRMBatch(apiUrl, token, pageId, `&is_read=${isRead}`);
            if (readBatch.conversations.length > 0) {
                addBatch(readBatch.conversations, `is_read:${isRead}`);
            }
        }
    }

    // ═══ FILTER: chỉ giữ conversations thuộc đúng page_id ═══
    // Normalize cả 2 phía để tránh mismatch do scientific notation hay number vs string
    const normalizePageId = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'number') return String(BigInt(Math.trunc(v)));
        const s = String(v).trim();
        // Nếu là scientific notation (e.g. "1.234e+17") → convert qua Number rồi BigInt
        if (/e[+-]?\d+/i.test(s)) {
            try { return String(BigInt(Math.trunc(Number(s)))); } catch { return s; }
        }
        return s;
    };
    const targetPageId = normalizePageId(pageId);
    const filteredConversations = allConversations.filter(c => normalizePageId(c.page_id) === targetPageId);

    console.log(`[broadcast] CRM after page_id filter: ${filteredConversations.length} (from ${allConversations.length} total merged)`);

    // ═══ RESOLVE TAG IDs → TAG NAMES ═══
    let tagMap: Map<number, string> = new Map();
    try {
        const tagUrl = `${apiUrl}/pages/${pageId}/conversation_tags?access_token=${token}`;
        const tagRes = await fetch(tagUrl);
        const tagData = await tagRes.json();
        if (tagData.conversation_tags) {
            for (const t of tagData.conversation_tags) {
                tagMap.set(Number(t.id), String(t.name || ''));
            }
            console.log(`[broadcast] CRM tags resolved: ${tagMap.size} tags for pageId=${pageId}`);
        }
    } catch (err) {
        console.error(`[broadcast] CRM tag resolution failed:`, err);
    }

    const allCustomers = filteredConversations
        .filter((c) => c && c.id && (c.from_psid || c.from?.id))
        .map((c) => {
            let phone = "";
            const phoneArr = c.recent_phone_numbers || [];
            if (phoneArr.length > 0) {
                const p = phoneArr[0];
                if (typeof p === 'string') {
                    phone = p;
                } else if (p && typeof p === 'object') {
                    phone = (p as Record<string, string>).phone_number || (p as Record<string, string>).captured || String(p);
                }
            }
            if (!phone && c.has_phone) {
                phone = "has_phone";
            }

            const resolvedTags = (c.tags || []).map((t: number) => {
                const name = tagMap.get(Number(t));
                return name || String(t);
            });

            return {
                id: String(c.id || ""),
                customerName: String(c.from?.name || c.customers?.[0]?.name || "Không rõ tên"),
                customerPhone: phone,
                fbId: String(c.id || ""),
                psid: String(c.from_psid || c.from?.id || ""),
                pageFbId: String(c.page_id || pageId),
                customerId: String(c.customers?.[0]?.id || ""),
                conversationLink: `https://pages.fm/conversations/${String(c.id || "")}`,
                orderCount: 0,
                messageCount: Number(c.message_count) || 0,
                snippet: String(c.snippet || "").replace(/[\r\n]+/g, " ").slice(0, 100),
                tags: resolvedTags,
                address: "",
                updatedAt: String(c.updated_at || c.inserted_at || ""),
                lastInteraction: String(c.last_customer_interactive_at || ""),
                source: "crm" as const,
            };
        });

    // Collect unique page_ids for debugging
    const uniquePageIds = new Map<string, number>();
    for (const c of allConversations) {
        const pid = String(c.page_id || 'unknown');
        uniquePageIds.set(pid, (uniquePageIds.get(pid) || 0) + 1);
    }

    return {
        customers: allCustomers,
        total: allCustomers.length,
        page: 1,
        totalPages: 1,
        source: "crm",
        debug: {
            rawTotal: allConversations.length,
            filteredTotal: filteredConversations.length,
            requestedPageId: pageId,
            pageIdBreakdown: Object.fromEntries(uniquePageIds),
            strategies: strategyLog,
            note: allConversations.length > 500
                ? `Multi-strategy fetch: vượt 500 cap! Lấy được ${allConversations.length} conversations`
                : batch1.conversations.length >= 500
                    ? "Hit 500 cap nhưng các strategy khác không tìm thêm được data mới"
                    : `Chỉ có ${allConversations.length} conversations (dưới 500 cap)`,
        },
    };
}

// ─── Meta Graph API: fetch conversations directly (BYPASS Pancake 500 cap) ───
// Lấy toàn bộ conversations của 1 page bằng cursor pagination thật.
// Không bị cap 500 — có thể lấy hàng chục nghìn conversations / page.
interface MetaConversation {
    id: string;
    updated_time: string;
    snippet?: string;
    message_count?: number;
    unread_count?: number;
    participants?: { data: Array<{ id: string; name?: string; email?: string }> };
}

async function fetchMetaConversations(
    pageId: string,
    pageAccessToken: string,
    maxPages: number = 50,
): Promise<{
    customers: Array<Record<string, unknown>>;
    raw: number;
    pages: number;
    error?: string;
}> {
    const customers: Array<Record<string, unknown>> = [];
    const seenPsids = new Set<string>();
    let raw = 0;
    let pageCount = 0;

    const fields = "id,updated_time,snippet,message_count,unread_count,participants";
    let url = `https://graph.facebook.com/v21.0/${pageId}/conversations?platform=messenger&fields=${fields}&limit=100&access_token=${pageAccessToken}`;

    try {
        while (url && pageCount < maxPages) {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
                return { customers, raw, pages: pageCount, error: `[${data.error.code}] ${data.error.message}` };
            }

            const batch: MetaConversation[] = data.data || [];
            raw += batch.length;
            pageCount++;

            for (const conv of batch) {
                const participants = conv.participants?.data || [];
                // Tìm participant ≠ pageId → đó là khách
                const customer = participants.find(p => String(p.id) !== String(pageId));
                if (!customer || !customer.id) continue;
                if (seenPsids.has(customer.id)) continue;
                seenPsids.add(customer.id);

                customers.push({
                    id: String(conv.id),
                    customerName: customer.name || "Không rõ tên",
                    customerPhone: "",
                    fbId: String(conv.id),
                    psid: String(customer.id),
                    pageFbId: String(pageId),
                    customerId: "",
                    conversationLink: `https://www.facebook.com/${conv.id}`,
                    orderCount: 0,
                    messageCount: Number(conv.message_count) || 0,
                    snippet: String(conv.snippet || "").replace(/[\r\n]+/g, " ").slice(0, 100),
                    tags: [],
                    address: "",
                    updatedAt: String(conv.updated_time || ""),
                    lastInteraction: String(conv.updated_time || ""),
                    source: "meta" as const,
                });
            }

            url = data.paging?.next || "";
            if (!url) break;
        }

        console.log(`[broadcast] Meta Graph: ${customers.length} unique PSIDs from ${raw} conversations across ${pageCount} pages`);
        return { customers, raw, pages: pageCount };
    } catch (err) {
        return { customers, raw, pages: pageCount, error: err instanceof Error ? err.message : String(err) };
    }
}

// ─── POS Customers fetcher (fallback) ─────────────────────────────────────────
async function fetchPOSCustomers(
    config: ScriptGeneratorConfig,
    shop: ShopConfig,
    _page: string,
    pageFilter: string
): Promise<NextResponse> {
    const pageSize = 50;
    const allCustomers: Array<Record<string, unknown>> = [];
    const seenIds = new Set<string>(); // Dedup giống CRM
    let currentPage = 1;
    let hasMore = true;
    const maxPages = 30;

    while (hasMore && currentPage <= maxPages) {
        const url = `${config.poscake.api_url}/shops/${shop.shop_id}/customers?api_key=${shop.api_key}&page=${currentPage}&page_size=${pageSize}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                if (allCustomers.length === 0) {
                    return NextResponse.json({ error: `POS API lỗi: ${res.status}` }, { status: res.status });
                }
                break;
            }

            const data = await res.json();
            const batch = (data.data || []).map((c: PancakeCustomer) => ({
                id: c.id,
                customerName: c.name || "Không rõ tên",
                customerPhone: c.phone_numbers?.[0] || "",
                fbId: c.fb_id || "",
                psid: c.fb_id ? c.fb_id.split("_").slice(1).join("_") : "",
                pageFbId: c.fb_id ? c.fb_id.split("_")[0] : "",
                customerId: c.customer_id || "",
                conversationLink: c.conversation_link || "",
                orderCount: c.order_count || 0,
                messageCount: 0,
                snippet: "",
                tags: (c.tags || []).map((t: { name: string }) => t.name),
                address: c.shop_customer_addresses?.[0]?.full_address || "",
                updatedAt: c.updated_at || c.inserted_at || "",
                lastInteraction: "",
                source: "pos" as const,
            }));

            // Dedup: chỉ thêm customers chưa thấy
            let newCount = 0;
            for (const c of batch) {
                const cId = String(c.id || '');
                if (cId && !seenIds.has(cId)) {
                    seenIds.add(cId);
                    allCustomers.push(c);
                    newCount++;
                }
            }

            if (newCount === 0) {
                // Toàn duplicates → stop
                break;
            }

            if (batch.length < pageSize) {
                hasMore = false;
            } else {
                currentPage++;
            }
        } catch (err) {
            console.error(`[broadcast] POS fetch page ${currentPage} error:`, err);
            break;
        }
    }

    let customers = allCustomers;
    if (pageFilter) {
        customers = customers.filter((c: Record<string, unknown>) => c.pageFbId === pageFilter);
    }

    console.log(`[broadcast] POS loaded ${customers.length} customers (total fetched: ${allCustomers.length})`);

    return NextResponse.json({
        customers,
        total: customers.length,
        page: 1,
        totalPages: 1,
        source: "pos",
    });
}

// ─── POST: Gửi tin nhắn hàng loạt qua Pancake Public API ─────────────────────
interface BroadcastRequest {
    recipients: Array<{ psid: string; pageFbId: string; name: string; conversationId?: string }>;
    message: string;
    forceGraphAPI?: boolean;
}

// Generate Pancake Page Access Token
async function generatePageAccessToken(
    pageId: string,
    userToken: string
): Promise<string | null> {
    try {
        const res = await fetch(
            `https://pages.fm/api/v1/pages/${pageId}/generate_page_access_token?access_token=${userToken}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (data.success && data.page_access_token) {
            return data.page_access_token;
        }
        console.error("[broadcast] Generate token failed:", data);
        return null;
    } catch (err) {
        console.error("[broadcast] Generate token error:", err);
        return null;
    }
}

// ─── Facebook Graph API: Get ALL Page Access Tokens ───────────────────────────
// Pancake page IDs ≠ Facebook page IDs → phải lấy tất cả từ /me/accounts
const fbAllPagesCache: { pages: Map<string, string>; byName: Map<string, string>; expires: number } = {
    pages: new Map(), byName: new Map(), expires: 0
};

async function loadFacebookPages(userAccessToken: string): Promise<void> {
    if (fbAllPagesCache.expires > Date.now()) return; // Cache valid
    
    fbAllPagesCache.pages.clear();
    fbAllPagesCache.byName.clear();
    
    let url = `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}&limit=100&fields=id,name,access_token`;
    let pageCount = 0;
    
    // Pagination — lấy hết tất cả pages
    while (url) {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.data) break;
        
        for (const page of data.data) {
            if (page.access_token) {
                fbAllPagesCache.pages.set(String(page.id), page.access_token);
                // Cache by normalized name for fuzzy matching
                const normName = (page.name || '').toLowerCase().trim();
                fbAllPagesCache.byName.set(normName, page.access_token);
                pageCount++;
            }
        }
        
        url = data.paging?.next || '';
    }
    
    fbAllPagesCache.expires = Date.now() + 3600000; // Cache 1 giờ
    console.log(`[fb] Loaded ${pageCount} Facebook page tokens`);
}

async function getFacebookPageToken(pageId: string, userAccessToken: string, pageName?: string, configPageTokens?: Record<string, string>): Promise<string | null> {
    // 1. Ưu tiên page_tokens trực tiếp từ config (không cần /me/accounts)
    if (configPageTokens) {
        const directToken = configPageTokens[pageId];
        if (directToken) {
            console.log(`[fb] Using direct page token from config for pageId=${pageId}`);
            return directToken;
        }
        // Nếu config có page_tokens nhưng không có pageId cụ thể → dùng token đầu tiên làm fallback
        const firstConfigToken = Object.values(configPageTokens)[0];
        if (firstConfigToken) {
            console.log(`[fb] pageId=${pageId} not in config page_tokens → using first config token as fallback`);
            return firstConfigToken;
        }
    }

    // 2. Fallback: lookup qua /me/accounts
    await loadFacebookPages(userAccessToken);
    
    // Try by page ID first
    const byId = fbAllPagesCache.pages.get(pageId);
    if (byId) return byId;
    
    // Try by page name (fuzzy match — Pancake page name might match FB page name)
    if (pageName) {
        const normName = pageName.toLowerCase().trim();
        const byName = fbAllPagesCache.byName.get(normName);
        if (byName) return byName;
        
        // Partial match
        for (const [name, token] of fbAllPagesCache.byName) {
            if (name.includes(normName) || normName.includes(name)) return token;
        }
    }
    
    // 3. Last resort: try Graph API directly
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${userAccessToken}`);
        const data = await res.json();
        if (data.access_token) return data.access_token;
    } catch { /* ignore */ }
    
    // 4. Use first available token from /me/accounts
    const firstCachedToken = fbAllPagesCache.pages.values().next().value;
    if (firstCachedToken) {
        console.warn(`[fb] No exact match for pageId=${pageId} → using first cached token`);
        return firstCachedToken;
    }
    
    console.error(`[fb] No page token found for pageId=${pageId} name=${pageName}`);
    return null;
}

// ─── Facebook Graph API: Send Message via Send API ────────────────────────────
// Thử lần lượt nhiều message tags: HUMAN_AGENT → POST_PURCHASE_UPDATE → ACCOUNT_UPDATE → RESPONSE
// Error #100 = app chưa được approved tag đó → thử tag tiếp theo
async function sendViaFacebookGraphAPI(
    psid: string,
    messageText: string,
    pageAccessToken: string
): Promise<{ success: boolean; error?: string; messageId?: string; tagUsed?: string }> {
    const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`;
    const tokenPrefix = pageAccessToken.slice(0, 10);
    
    // Tag fallback chain
    const tagAttempts: Array<{ messaging_type: string; tag?: string; label: string }> = [
        { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT",           label: "HUMAN_AGENT" },
        { messaging_type: "MESSAGE_TAG", tag: "POST_PURCHASE_UPDATE",   label: "POST_PURCHASE_UPDATE" },
        { messaging_type: "MESSAGE_TAG", tag: "ACCOUNT_UPDATE",         label: "ACCOUNT_UPDATE" },
        { messaging_type: "RESPONSE",                                    label: "RESPONSE" },
    ];

    const errors: string[] = [];
    for (const attempt of tagAttempts) {
        try {
            const body: Record<string, unknown> = {
                recipient: { id: psid },
                message: { text: messageText },
                messaging_type: attempt.messaging_type,
            };
            if (attempt.tag) body.tag = attempt.tag;

            console.log(`[fb-send] token=${tokenPrefix}... tag=${attempt.label} psid=${psid}`);
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.error) {
                const code = data.error.code || data.error.error_code;
                const msg = data.error.message || JSON.stringify(data.error);
                const errEntry = `${attempt.label}[#${code}]:${msg.slice(0, 80)}`;
                console.warn(`[fb-send] FAIL ${errEntry}`);
                errors.push(errEntry);
                // #100/#200 = no permission for tag → try next
                // #10 = outside window → try next
                // #190 = invalid/wrong token format (e.g. Pancake token used w/ Graph API)
                if (code === 100 || code === 200 || code === 10 || code === 190 ||
                    String(code) === '100' || String(code) === '200' || String(code) === '10' || String(code) === '190') {
                    continue;
                }
                // Fatal errors (#551 blocked, #613 rate limit) → stop
                return { success: false, error: `FB API: ${errEntry}` };
            }

            if (data.recipient_id && data.message_id) {
                console.log(`[fb-send] ✅ tag=${attempt.label} token=${tokenPrefix}...`);
                return { success: true, messageId: data.message_id, tagUsed: attempt.label };
            }

            errors.push(`${attempt.label}:unexpected=${JSON.stringify(data).slice(0, 50)}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[fb-send] Exception ${attempt.label}:`, msg);
            errors.push(`${attempt.label}:exception=${msg.slice(0, 50)}`);
        }
    }

    const errSummary = errors.join(' | ');
    console.error(`[fb-send] All tags exhausted. PSID=${psid} token=${tokenPrefix}... | ${errSummary}`);
    return { success: false, error: `FB API (tất cả tags thất bại): ${errSummary}` };
}

// ─── Facebook Graph API: Send Image Attachment ────────────────────────────────
async function sendImageViaFacebookGraphAPI(
    psid: string,
    imageUrl: string,
    pageAccessToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`;
        const body = {
            recipient: { id: psid },
            message: {
                attachment: {
                    type: "image",
                    payload: { url: imageUrl, is_reusable: true },
                },
            },
            messaging_type: "MESSAGE_TAG",
            tag: "HUMAN_AGENT",
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.error) {
            return { success: false, error: `FB Image: ${data.error.message}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: `FB Image Error: ${err instanceof Error ? err.message : String(err)}` };
    }
}


// ═══ SERVER-SIDE DEDUP CACHE ═══
// Chống gửi lặp: từ chối gửi cùng PSID trong 5 phút
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 phút
const sentCache = new Map<string, number>(); // psid -> timestamp

function cleanupDedup() {
    const now = Date.now();
    for (const [key, ts] of sentCache) {
        if (now - ts > DEDUP_WINDOW_MS) sentCache.delete(key);
    }
}

export async function POST(req: NextRequest) {
    try {
        const config = loadConfig();
        
        // Parse body: hỗ trợ cả JSON lẫn FormData (multipart)
        let recipients: Array<{ psid: string; pageFbId: string; name: string; conversationId?: string }>;
        let message: string;
        let forceGraphAPI = false;
        let imageFiles: File[] = []; // File objects from FormData
        let imageStrings: string[] = []; // base64 strings from JSON

        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            recipients = JSON.parse(formData.get('recipients') as string || '[]');
            message = (formData.get('message') as string) || '';
            forceGraphAPI = formData.get('forceGraphAPI') === 'true';
            // getAll trả về tất cả files gửi với key 'images'
            const imgEntries = formData.getAll('images');
            for (const entry of imgEntries) {
                if (entry instanceof File) {
                    imageFiles.push(entry);
                }
            }
            console.log(`[broadcast] FormData: ${recipients.length} recipients, ${imageFiles.length} image files, forceGraphAPI=${forceGraphAPI}`);
        } else {
            const body = await req.json();
            recipients = body.recipients;
            message = body.message || '';
            imageStrings = body.images || [];
            forceGraphAPI = body.forceGraphAPI === true;
        }

        const hasImages = imageFiles.length > 0 || imageStrings.length > 0;
        if (!recipients?.length || (!message?.trim() && !hasImages)) {
            return NextResponse.json(
                { error: "Thiếu thông tin: recipients, message hoặc images" },
                { status: 400 }
            );
        }

        const crmToken = config.pancake_crm?.api_token;
        if (!crmToken && !forceGraphAPI) {
            return NextResponse.json(
                { error: "Chưa cấu hình pancake_crm.api_token trong config." },
                { status: 500 }
            );
        }

        // Facebook Graph API token (for fallback or force mode)
        // Prefer facebook_messaging token (Chat page app) over meta_ads token (Ads app)
        const fbUserToken = config.facebook_messaging?.user_access_token || config.meta_ads?.access_token;
        const hasFbToken = !!fbUserToken;

        // Group recipients by page to generate tokens per page
        const pageGroups = new Map<string, typeof recipients>();
        for (const r of recipients) {
            const pageId = r.pageFbId;
            if (!pageGroups.has(pageId)) pageGroups.set(pageId, []);
            pageGroups.get(pageId)!.push(r);
        }

        // Generate page tokens (Pancake)
        const pageTokens = new Map<string, string>();
        if (crmToken) {
            for (const pageId of pageGroups.keys()) {
                const token = await generatePageAccessToken(pageId, crmToken);
                if (token) pageTokens.set(pageId, token);
            }
        }

        const results: Array<{
            psid: string;
            name: string;
            success: boolean;
            error?: string;
            via?: 'pancake' | 'fb_graph_api';
        }> = [];

        // Pre-load Facebook page tokens if needed
        const fbPageTokens = new Map<string, string>();
        const configPageTokens = config.facebook_messaging?.page_tokens;
        if (hasFbToken && fbUserToken) {
            try {
                for (const pageId of pageGroups.keys()) {
                    const fbToken = await getFacebookPageToken(pageId, fbUserToken, undefined, configPageTokens);
                    if (fbToken) {
                        fbPageTokens.set(pageId, fbToken);
                        console.log(`[fb] Resolved token for pageId=${pageId}`);
                    }
                }
                console.log(`[fb] Pre-loaded ${fbPageTokens.size} FB page tokens`);
            } catch (err) {
                console.error('[fb] Failed to pre-load FB page tokens:', err);
            }
        }

        // Cleanup dedup cache
        cleanupDedup();

        for (const recipient of recipients) {
            // ═══ DEDUP CHECK: đã gửi PSID này trong 5 phút? ═══
            const dedupKey = `${recipient.psid}_${recipient.pageFbId}`;
            if (sentCache.has(dedupKey)) {
                const lastSent = sentCache.get(dedupKey)!;
                const secsAgo = Math.round((Date.now() - lastSent) / 1000);
                console.log(`[DEDUP] BLOCKED: ${recipient.name} (${recipient.psid}) - đã gửi ${secsAgo}s trước`);
                results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `⚠️ Đã gửi ${secsAgo}s trước (chặn lặp)` });
                continue;
            }
            // Mark as sent TRƯỚC khi gửi
            sentCache.set(dedupKey, Date.now());
            try {
                const pageId = recipient.pageFbId;
                const pageToken = pageTokens.get(pageId);
                const fbPageToken = fbPageTokens.get(pageId);

                // ═══ FORCE GRAPH API MODE ═══
                if (forceGraphAPI) {
                    if (!fbPageToken) {
                        results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `❌ Không có FB token cho page ${pageId}`, via: 'fb_graph_api' });
                        continue;
                    }
                    let textOk = true;
                    let imgOk = true;

                    if (message?.trim()) {
                        const fbResult = await sendViaFacebookGraphAPI(recipient.psid, message.trim(), fbPageToken);
                        textOk = fbResult.success;
                        if (!textOk) {
                            results.push({ psid: recipient.psid, name: recipient.name, success: false, error: fbResult.error, via: 'fb_graph_api' });
                            await new Promise(r => setTimeout(r, 500));
                            continue;
                        }
                    }

                    // Images via Graph API
                    if (imageFiles.length > 0 || imageStrings.length > 0) {
                        const filesToSend: { base64: string; type: string }[] = [];
                        for (const f of imageFiles) {
                            const arrBuf = await f.arrayBuffer();
                            filesToSend.push({ base64: Buffer.from(arrBuf).toString('base64'), type: f.type });
                        }
                        for (const s of imageStrings) {
                            if (s.startsWith('data:')) {
                                const m = s.match(/^data:([^;]+);base64,(.+)$/);
                                if (m) filesToSend.push({ base64: m[2], type: m[1] });
                            }
                        }
                        for (const { base64 } of filesToSend) {
                            try {
                                // Upload to freeimage.host then send URL via Graph API
                                const uploadFd = new FormData();
                                uploadFd.append('source', base64);
                                uploadFd.append('type', 'base64');
                                uploadFd.append('action', 'upload');
                                const uploadRes = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', { method: 'POST', body: uploadFd });
                                const uploadData = await uploadRes.json().catch(() => ({}));
                                const uploadUrl = uploadData?.image?.url;
                                if (uploadUrl) {
                                    const imgResult = await sendImageViaFacebookGraphAPI(recipient.psid, uploadUrl, fbPageToken);
                                    if (!imgResult.success) imgOk = false;
                                } else {
                                    imgOk = false;
                                }
                                await new Promise(r => setTimeout(r, 300));
                            } catch { imgOk = false; }
                        }
                    }

                    if (textOk && imgOk) {
                        results.push({ psid: recipient.psid, name: recipient.name, success: true, via: 'fb_graph_api' });
                    } else if (textOk) {
                        results.push({ psid: recipient.psid, name: recipient.name, success: true, error: '⚠️ Text OK, ảnh lỗi', via: 'fb_graph_api' });
                    } else {
                        results.push({ psid: recipient.psid, name: recipient.name, success: false, error: 'Gửi thất bại', via: 'fb_graph_api' });
                    }
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                // ═══ NORMAL MODE: Pancake first, FB Graph API fallback ═══
                if (!pageToken) {
                    // No Pancake token → try FB Graph API directly
                    if (fbPageToken && message?.trim()) {
                        console.log(`[fb-fallback] No Pancake token for page ${pageId}, trying FB Graph API directly`);
                        const fbResult = await sendViaFacebookGraphAPI(recipient.psid, message.trim(), fbPageToken);
                        results.push({ psid: recipient.psid, name: recipient.name, success: fbResult.success, error: fbResult.error, via: 'fb_graph_api' });
                    } else {
                        results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `Không tạo được token cho page ${pageId}` });
                    }
                    continue;
                }

                const convoId = recipient.conversationId || `${pageId}_${recipient.psid}`;
                const apiBase = `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations/${convoId}/messages?page_access_token=${pageToken}`;

                // ═══ DEBUG: Log full request details ═══
                console.log(`[broadcast][DEBUG] ━━━ SEND TO: ${recipient.name} (${recipient.psid}) ━━━`);
                console.log(`[broadcast][DEBUG] pageId=${pageId}, convoId=${convoId}`);
                console.log(`[broadcast][DEBUG] URL=${apiBase.replace(pageToken, 'TOKEN_HIDDEN')}`);
                console.log(`[broadcast][DEBUG] conversationId from recipient: ${recipient.conversationId || 'MISSING (fallback used)'}`);

                let textSuccess = true;
                let imageSuccess = true;
                let sentVia: 'pancake' | 'fb_graph_api' = 'pancake';

                // 1. Gửi tin nhắn text trước
                if (message?.trim()) {
                    const reqBody = {
                        action: "reply_inbox",
                        message: message.trim(),
                    };
                    console.log(`[broadcast][DEBUG] Request body:`, JSON.stringify(reqBody));
                    
                    const sendRes = await fetch(apiBase, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(reqBody),
                    });
                    const sendText = await sendRes.text();
                    console.log(`[broadcast][DEBUG] Response status=${sendRes.status}, body=${sendText.slice(0, 500)}`);
                    
                    let sendData: Record<string, unknown> = {};
                    try { sendData = JSON.parse(sendText); } catch { sendData = { raw: sendText.slice(0, 200) }; }
                    
                    if (!sendData.success) {
                        // ═══ FB GRAPH API FALLBACK: Try HUMAN_AGENT tag (7 days window) ═══
                        const errMsg = String(sendData.original_error || sendData.message || sendData.error || '');
                        const errCode = sendData.error_code || sendData.code || '';
                        
                        // ═══ EXPANDED: Detect ALL messaging errors that should trigger FB fallback ═══
                        // #10  = outside 24h window (OOW)
                        // #551 = "Người này hiện không có mặt" / user not available  
                        // #100 = invalid parameter / no matching user
                        // #200 = permission error
                        // #2018001 = message delivery failed
                        // Generic: Cannot send, blocked, unavailable
                        const shouldFallbackToFB = 
                            // Error #10: outside 24h window
                            errMsg.includes('(#10)') ||
                            errMsg.includes('error_code=10') ||
                            /\berror[^\w]*10\b/i.test(errMsg) ||
                            errCode === 10 || errCode === '10' ||
                            // Error #551: user not available / không có mặt
                            errMsg.includes('(#551)') ||
                            errCode === 551 || errCode === '551' ||
                            errMsg.toLowerCase().includes('không có mặt') ||
                            errMsg.toLowerCase().includes('not available') ||
                            errMsg.toLowerCase().includes('unavailable') ||
                            // Error #100: invalid parameter 
                            errMsg.includes('(#100)') ||
                            errCode === 100 || errCode === '100' ||
                            // Error #200: permission
                            errMsg.includes('(#200)') ||
                            errCode === 200 || errCode === '200' ||
                            // Error #2018001: delivery failed
                            errMsg.includes('(#2018001)') ||
                            errCode === 2018001 || errCode === '2018001' ||
                            // Generic patterns
                            errMsg.toLowerCase().includes('outside') ||
                            errMsg.toLowerCase().includes('ngoài khoảng') ||
                            errMsg.toLowerCase().includes('ngoai khoang') ||
                            errMsg.includes('Cannot send') ||
                            errMsg.includes('OOW') ||
                            errMsg.toLowerCase().includes('24-hour') ||
                            errMsg.toLowerCase().includes('24h') ||
                            errMsg.toLowerCase().includes('blocked') ||
                            errMsg.toLowerCase().includes('bị chặn');
                        
                        // ═══ ALWAYS try FB fallback when Pancake fails ═══
                        // Nếu không match pattern cụ thể → vẫn thử FB nếu có token
                        const hasFbFallback = !!fbPageToken;
                        
                        if (shouldFallbackToFB || hasFbFallback) {
                            // Validate PSID: phải là số thuần, không phải Pancake internal ID
                            const psidToUse = recipient.psid;
                            const isValidPSID = /^\d+$/.test(psidToUse) && psidToUse.length >= 10;
                            
                            if (!isValidPSID) {
                                console.warn(`[fb-fallback] ⚠️ INVALID PSID: "${psidToUse}" for ${recipient.name} — looks like Pancake internal ID, not Facebook PSID`);
                                textSuccess = false;
                                results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `Pancake: ${errMsg} → PSID không hợp lệ (${psidToUse}) — không phải Facebook PSID`, via: 'pancake' });
                                await new Promise((resolve) => setTimeout(resolve, 500));
                                continue;
                            }
                            
                            // Chỉ dùng TalphaBot token — Pancake token không dùng được với Graph API (#190)
                            const tokensToTry: Array<{ token: string; label: string }> = [];
                            if (fbPageToken) tokensToTry.push({ token: fbPageToken, label: 'TalphaBot' });

                            const fallbackReason = shouldFallbackToFB ? 'matched error pattern' : 'generic Pancake failure';
                            console.log(`[fb-fallback] ${recipient.name} | PSID=${psidToUse} | pageId=${pageId} | reason=${fallbackReason} | pancakeErr=${errMsg.slice(0, 80)} | tokens=${tokensToTry.map(t=>t.label).join(',')||'NONE'}`);

                            let fbSuccess = false;
                            let fbError = '';
                            for (const { token: tryToken, label } of tokensToTry) {
                                console.log(`[fb-fallback] Trying ${label} token for ${recipient.name} (PSID=${psidToUse})`);
                                const fbResult = await sendViaFacebookGraphAPI(psidToUse, message.trim(), tryToken);
                                if (fbResult.success) {
                                    fbSuccess = true;
                                    textSuccess = true;
                                    sentVia = 'fb_graph_api';
                                    console.log(`[fb-fallback] ✅ SUCCESS via ${label} for ${recipient.name} (tag=${fbResult.tagUsed})`);
                                    break;
                                }
                                fbError = `${label}: ${fbResult.error || ''}`;
                                console.warn(`[fb-fallback] ${label} failed for ${recipient.name}: ${fbResult.error}`);
                            }

                            if (!fbSuccess) {
                                textSuccess = false;
                                results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `Pancake: ${errMsg.slice(0, 60)} → FB: ${fbError || 'Không có token'}`, via: 'fb_graph_api' });
                                await new Promise((resolve) => setTimeout(resolve, 500));
                                continue;
                            }
                        } else {
                            textSuccess = false;
                            const displayErr = sendData.original_error || sendData.message || `HTTP ${sendRes.status}`;
                            results.push({ psid: recipient.psid, name: recipient.name, success: false, error: `Text: ${String(displayErr)}`, via: 'pancake' });
                            await new Promise((resolve) => setTimeout(resolve, 500));
                            continue;
                        }
                    }
                }

                // 2. Gửi hình ảnh: Upload → freeimage.host → Gửi URL qua tin nhắn text
                if (imageFiles.length > 0 || imageStrings.length > 0) {
                    const filesToSend: { base64: string; type: string }[] = [];
                    
                    // Convert Files → base64
                    for (const f of imageFiles) {
                        const arrBuf = await f.arrayBuffer();
                        filesToSend.push({ base64: Buffer.from(arrBuf).toString('base64'), type: f.type });
                    }
                    // Convert data URLs → base64
                    for (const s of imageStrings) {
                        if (s.startsWith('data:')) {
                            const m = s.match(/^data:([^;]+);base64,(.+)$/);
                            if (m) filesToSend.push({ base64: m[2], type: m[1] });
                        }
                    }

                    for (let imgIdx = 0; imgIdx < filesToSend.length; imgIdx++) {
                        try {
                            const { base64 } = filesToSend[imgIdx];
                            
                            // Upload ảnh lên freeimage.host (free, permanent)
                            const uploadFd = new FormData();
                            uploadFd.append('source', base64);
                            uploadFd.append('type', 'base64');
                            uploadFd.append('action', 'upload');
                            const uploadRes = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
                                method: 'POST', body: uploadFd,
                            });
                            const uploadData = await uploadRes.json().catch(() => ({}));
                            const uploadUrl = uploadData?.image?.url;
                            console.log(`[img] Upload img${imgIdx} for ${recipient.name}: ${uploadUrl || 'FAILED'}`);

                            if (uploadUrl) {
                                // Gửi URL qua tin nhắn text (Pancake API)
                                const sendImgRes = await fetch(apiBase, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "reply_inbox", message: uploadUrl }),
                                });
                                const sendImgData = await sendImgRes.json().catch(() => ({}));
                                console.log(`[img] Send URL result:`, JSON.stringify(sendImgData).slice(0, 200));
                                if (!sendImgData.success) {
                                    imageSuccess = false;
                                    console.error(`[img] Send URL FAILED:`, sendImgData.original_error || sendImgData.message);
                                }
                            } else {
                                imageSuccess = false;
                                console.error(`[img] freeimage.host upload FAILED:`, JSON.stringify(uploadData).slice(0, 200));
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 300));
                        } catch (imgErr) {
                            imageSuccess = false;
                            console.error(`[img] Exception img${imgIdx}:`, imgErr instanceof Error ? imgErr.message : imgErr);
                        }
                    }
                }

                if (textSuccess && imageSuccess) {
                    results.push({ psid: recipient.psid, name: recipient.name, success: true, via: sentVia });
                } else if (textSuccess && !imageSuccess) {
                    results.push({ psid: recipient.psid, name: recipient.name, success: true, error: "⚠️ Text OK, ảnh lỗi", via: sentVia });
                } else {
                    results.push({ psid: recipient.psid, name: recipient.name, success: false, error: "Gửi thất bại", via: sentVia });
                }

                // Delay 500ms between recipients
                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (err: unknown) {
                results.push({
                    psid: recipient.psid,
                    name: recipient.name,
                    success: false,
                    error: err instanceof Error ? err.message : "Network error",
                });
            }
        }

        const successCount = results.filter((r) => r.success).length;

        return NextResponse.json({
            success: successCount > 0,
            message: `✅ Đã gửi ${successCount}/${results.length} tin nhắn`,
            successCount,
            totalCount: results.length,
            results,
        });
    } catch (error: unknown) {
        console.error("[broadcast] POST Error:", error);
        const errMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errMessage }, { status: 500 });
    }
}
