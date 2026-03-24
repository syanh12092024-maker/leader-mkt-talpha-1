// Focused test: call the EXACT same Pancake endpoint as route.ts
// We need a real page_id and conversation_id

const CRM_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbmZvIjp7Im9zIjoxLCJjbGllbnRfaXAiOiIxLjUyLjIzMi4xODIiLCJicm93c2VyIjoxLCJkZXZpY2VfdHlwZSI6M30sIm5hbWUiOiJT4bu5IEFuaCIsImV4cCI6MTc4MTY2MzQ0NCwiYXBwbGljYXRpb24iOjEsInVpZCI6IjQxMjUxMzliLTFhNGItNDBjMS04MjQwLWNhYjYwYTRlODFiMSIsInNlc3Npb25faWQiOiJkZTEzODAxYy0zMzY5LTQ4M2EtODY4Zi1hZjc0MTc5NzRkMjMiLCJpYXQiOjE3NzM4ODc0NDQsImZiX2lkIjoiNzQ5NjM4MzA0NzMyMjM5IiwibG9naW5fc2Vzc2lvbiI6bnVsbCwiZmJfbmFtZSI6IlPhu7kgQW5oIn0.8K5HfAn39PSObxzlkHicjua4EXVRL3IjVq8Sy_xHhw8";

// Step 1: get page token for each shop's first page
async function safeFetch(url, opts) {
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return JSON.parse(text); } 
    catch { return { _raw: text.slice(0, 500), _status: res.status }; }
}

const POSCAKE_SHOPS = [
    { name: "Taiwan", api_key: "1d5e719041a34861be0076cdb26f9688", shop_id: "1328343252" },
    { name: "Japan", api_key: "de34eb3fc92041ce94a41cde5e78a8f9", shop_id: "100293585" },
];

async function main() {
    // Step 1: Get pages from POSCake (same as broadcast route.ts)
    for (const shop of POSCAKE_SHOPS) {
        console.log(`\n=== Shop: ${shop.name} ===`);
        const shopData = await safeFetch(
            `https://pos.pages.fm/api/v1/shops/${shop.shop_id}?api_key=${shop.api_key}`
        );
        const pages = (shopData?.shop?.pages || []);
        console.log(`Pages: ${pages.map(p => `${p.id}:${p.name}`).join(', ')}`);
        
        if (pages.length === 0) continue;
        
        const pageId = String(pages[0].id);
        console.log(`Using pageId: ${pageId}`);
        
        // Step 2: Generate page token
        const tokenRes = await safeFetch(
            `https://pages.fm/api/public_api/v1/pages/${pageId}/gen_page_access_token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_token: CRM_TOKEN }),
            }
        );
        const pageToken = tokenRes.page_access_token;
        if (!pageToken) {
            console.log("Token FAILED:", JSON.stringify(tokenRes).slice(0, 200));
            continue;
        }
        console.log("Token: OK");
        
        // Step 3: Get first conversation
        const convRes = await safeFetch(
            `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations?type=all&page_access_token=${pageToken}&limit=2`
        );
        const convos = convRes.conversations || [];
        if (convos.length === 0) {
            console.log("No conversations");
            continue;
        }
        const convo = convos[0];
        console.log(`Convo: ${convo.id} (${convo.customer_name}) platform=${convo.platform}`);
        
        const apiBase = `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations/${convo.id}/messages?page_access_token=${pageToken}`;
        
        // ═══ TEST IMAGE METHODS ═══
        const IMG_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
        const tinyPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAIAgL/4d1j8wAAAABJRU5ErkJggg==";
        const buffer = Buffer.from(tinyPngB64, 'base64');
        
        // M1: FormData + file (current approach)
        console.log("\n  M1: FormData action=reply_inbox + file");
        const fd1 = new FormData();
        fd1.append('action', 'reply_inbox');
        fd1.append('file', new File([buffer], 'test.png', { type: 'image/png' }));
        console.log("  →", JSON.stringify(await safeFetch(apiBase, { method: "POST", body: fd1 })).slice(0, 300));
        
        // M2: JSON attachment payload (FB Messenger SDK style)
        console.log("\n  M2: JSON attachment type=image url");
        console.log("  →", JSON.stringify(await safeFetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "reply_inbox",
                attachment: {
                    type: "image",
                    payload: { url: IMG_URL }
                }
            }),
        })).slice(0, 300));
        
        // M3: JSON image field
        console.log("\n  M3: JSON image field");
        console.log("  →", JSON.stringify(await safeFetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "reply_inbox",
                image: IMG_URL
            }),
        })).slice(0, 300));
        
        // M4: JSON attachments array
        console.log("\n  M4: JSON attachments array");
        console.log("  →", JSON.stringify(await safeFetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "reply_inbox",
                attachments: [{ type: "image", url: IMG_URL }]
            }),
        })).slice(0, 300));
        
        // M5: JSON message_type generic template
        console.log("\n  M5: JSON message_type with generic template");
        console.log("  →", JSON.stringify(await safeFetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "reply_inbox",
                message: {
                    attachment: {
                        type: "image",
                        payload: { url: IMG_URL, is_reusable: true }
                    }
                }
            }),
        })).slice(0, 300));

        // M6: FormData with message field empty + file
        console.log("\n  M6: FormData message='' + file");
        const fd6 = new FormData();
        fd6.append('action', 'reply_inbox');
        fd6.append('message', '');
        fd6.append('file', new File([buffer], 'test.png', { type: 'image/png' }));
        console.log("  →", JSON.stringify(await safeFetch(apiBase, { method: "POST", body: fd6 })).slice(0, 300));
        
        // M7: FormData with 'files' key (not 'file')
        console.log("\n  M7: FormData 'files' key");
        const fd7 = new FormData();
        fd7.append('action', 'reply_inbox');
        fd7.append('files', new File([buffer], 'test.png', { type: 'image/png' }));
        console.log("  →", JSON.stringify(await safeFetch(apiBase, { method: "POST", body: fd7 })).slice(0, 300));
        
        // M8: JSON type=send_file 
        console.log("\n  M8: JSON action=send_file");
        console.log("  →", JSON.stringify(await safeFetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "send_file",
                url: IMG_URL
            }),
        })).slice(0, 300));

        // Only test with first valid page
        break;
    }
}

main().catch(console.error);
