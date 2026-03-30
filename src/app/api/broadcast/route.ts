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

        if (!shopId) {
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
        let crmError: string | null = null;
        if (pageFilter && config.pancake_crm?.api_token) {
            try {
                const crmData = await fetchCRMConversations(
                    config.pancake_crm.api_url,
                    config.pancake_crm.api_token,
                    pageFilter,
                    Number(page)
                );
                if (crmData) return NextResponse.json(crmData);
                // CRM returned null = error occurred
                crmError = `CRM không trả data cho page ${pageFilter}. Có thể cần đăng nhập lại Pancake.`;
            } catch (err) {
                console.error("[broadcast] CRM fallback to POS:", err);
                crmError = `CRM lỗi: ${err instanceof Error ? err.message : String(err)}`;
            }
        }

        // ─── Fallback: POS Customers (only buyers) ────────────────────────
        const posResponse = await fetchPOSCustomers(config, shop, page, pageFilter);
        // Inject CRM warning into POS response so frontend can display it
        if (crmError) {
            const posData = await posResponse.json();
            return NextResponse.json({
                ...posData,
                crmWarning: `⚠️ ${crmError} — Chỉ hiển thị khách ĐÃ MUA từ POS. Để lấy TẤT CẢ khách nhắn tin, đăng nhập lại Pancake CRM.`,
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
async function fetchCRMConversations(
    apiUrl: string,
    token: string,
    pageId: string,
    _page: number
): Promise<object | null> {
    const limit = 200; // ═══ INCREASED: fetch 200 per page instead of 50 ═══
    const allConversations: CRMConversation[] = [];
    const seenIds = new Set<string>(); // ═══ DEDUP: track IDs đã thấy ═══
    let currentPage = 1;
    let emptyStreak = 0;
    const maxEmptyPages = 3; // ═══ INCREASED: cho phép 3 empty pages trước khi stop ═══
    const maxPages = 50; // ═══ INCREASED: max 50 pages × 200 = 10,000 conversations ═══
    let crmApiError: string | null = null;
    let consecutiveDupPages = 0; // Track consecutive all-duplicate pages

    // Loop through pages, STOP when truly no more data
    while (emptyStreak < maxEmptyPages && currentPage <= maxPages) {
        const url = `${apiUrl}/pages/${pageId}/conversations?access_token=${token}&limit=${limit}&page=${currentPage}`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error_code) {
                crmApiError = `[${data.error_code}] ${data.message || 'Unknown CRM error'}`;
                console.error(`[broadcast] CRM Error ${data.error_code}: ${data.message} | pageId=${pageId}`);
                if (data.platform_specific_error) {
                    console.error(`[broadcast] CRM Platform error: code=${data.platform_specific_error.code} subcode=${data.platform_specific_error.subcode} msg=${data.platform_specific_error.message}`);
                }
                if (allConversations.length === 0) return null;
                break;
            }

            const conversations: CRMConversation[] = data.conversations || [];
            
            if (conversations.length === 0) {
                emptyStreak++;
                currentPage++;
                continue;
            }
            
            // ═══ DEDUP CHECK ═══
            let newCount = 0;
            for (const c of conversations) {
                const cId = String(c.id || '');
                if (cId && !seenIds.has(cId)) {
                    seenIds.add(cId);
                    allConversations.push(c);
                    newCount++;
                }
            }

            console.log(`[broadcast] CRM page ${currentPage}: ${conversations.length} returned, ${newCount} new, ${conversations.length - newCount} dups | total=${allConversations.length}`);

            if (newCount === 0) {
                consecutiveDupPages++;
                // ═══ RELAXED: cần 2 consecutive all-duplicate pages mới stop ═══
                if (consecutiveDupPages >= 2) {
                    console.log(`[broadcast] CRM: ${consecutiveDupPages} consecutive all-duplicate pages → stopping`);
                    break;
                }
            } else {
                consecutiveDupPages = 0; // Reset khi có data mới
            }
            
            // Nếu API trả ít hơn limit → đã hết data
            if (conversations.length < limit) {
                console.log(`[broadcast] CRM page ${currentPage}: returned ${conversations.length} < limit ${limit} → last page`);
                break;
            }
            
            emptyStreak = 0;
            currentPage++;
        } catch (err) {
            console.error(`[broadcast] CRM fetch page ${currentPage} error:`, err);
            emptyStreak++;
            currentPage++;
        }
    }

    console.log(`[broadcast] CRM raw: ${allConversations.length} conversations across ${currentPage - 1} pages for pageId=${pageId}`);

    // ═══ FILTER: chỉ giữ conversations thuộc đúng page_id ═══
    // Pancake CRM có thể trả conversations từ nhiều pages (token-level access)
    const filteredConversations = allConversations.filter(c => {
        const cPageId = String(c.page_id || '');
        return cPageId === pageId;
    });

    console.log(`[broadcast] CRM after page_id filter: ${filteredConversations.length} (filtered from ${allConversations.length})`);

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
                tags: (c.tags || []).map((t: number) => String(t)),
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
            pagesScanned: currentPage - 1,
        },
    };
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
