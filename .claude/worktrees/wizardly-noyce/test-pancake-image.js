// Try to extract Facebook Page Access Token from Pancake API
const CRM_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbmZvIjp7Im9zIjoxLCJjbGllbnRfaXAiOiIxLjUyLjIzMi4xODIiLCJicm93c2VyIjoxLCJkZXZpY2VfdHlwZSI6M30sIm5hbWUiOiJT4bu5IEFuaCIsImV4cCI6MTc4MTY2MzQ0NCwiYXBwbGljYXRpb24iOjEsInVpZCI6IjQxMjUxMzliLTFhNGItNDBjMS04MjQwLWNhYjYwYTRlODFiMSIsInNlc3Npb25faWQiOiJkZTEzODAxYy0zMzY5LTQ4M2EtODY4Zi1hZjc0MTc5NzRkMjMiLCJpYXQiOjE3NzM4ODc0NDQsImZiX2lkIjoiNzQ5NjM4MzA0NzMyMjM5IiwibG9naW5fc2Vzc2lvbiI6bnVsbCwiZmJfbmFtZSI6IlPhu7kgQW5oIn0.8K5HfAn39PSObxzlkHicjua4EXVRL3IjVq8Sy_xHhw8";
const PAGE_ID = "1079273301926933";
const SHOP_ID = "1328343252";
const API_KEY = "1d5e719041a34861be0076cdb26f9688";

async function sf(url, opts) {
    const r = await fetch(url, opts || {});
    const t = await r.text();
    try { return { status: r.status, data: JSON.parse(t) }; }
    catch { return { status: r.status, data: { raw: t.slice(0, 300) } }; }
}

async function main() {
    // 1. Check if Pancake page info contains FB token
    console.log("=== 1. Page Info (Pancake) ===");
    const pageToken = (await sf(`https://pages.fm/api/v1/pages/${PAGE_ID}/generate_page_access_token?access_token=${CRM_TOKEN}`, { method: "POST" })).data.page_access_token;
    
    // Try various Pancake endpoints to find FB page token
    const endpoints = [
        `https://pages.fm/api/v1/pages/${PAGE_ID}?access_token=${CRM_TOKEN}`,
        `https://pages.fm/api/v1/pages/${PAGE_ID}/settings?access_token=${CRM_TOKEN}`,
        `https://pages.fm/api/v1/pages/${PAGE_ID}?page_access_token=${pageToken}`,
        `https://pages.fm/api/public_api/v1/pages/${PAGE_ID}?page_access_token=${pageToken}`,
        `https://pages.fm/api/v1/pages/${PAGE_ID}/info?access_token=${CRM_TOKEN}`,
        `https://pages.fm/api/v1/pages/${PAGE_ID}/facebook_info?access_token=${CRM_TOKEN}`,
    ];
    
    for (const url of endpoints) {
        const res = await sf(url);
        const key = url.split('?')[0].split('/').slice(-2).join('/');
        console.log(`\n${key} (${res.status}): ${JSON.stringify(res.data).slice(0, 300)}`);
        
        // Look for any FB-related tokens in the response
        const str = JSON.stringify(res.data);
        if (str.includes('EAAM') || str.includes('facebook_token') || str.includes('fb_token') || str.includes('page_token')) {
            console.log("  >>> FOUND POTENTIAL FB TOKEN! <<<");
        }
    }
    
    // 2. POS API - check page info
    console.log("\n\n=== 2. POS API Page Info ===");
    const shopRes = await sf(`https://pos.pages.fm/api/v1/shops/${SHOP_ID}?api_key=${API_KEY}`);
    const pages = shopRes.data?.shop?.pages || [];
    const bsPage = pages.find(p => p.name?.includes("Brightening"));
    if (bsPage) {
        console.log(`Brightening Soap page data: ${JSON.stringify(bsPage).slice(0, 500)}`);
        // Check if there's an FB token in page data
        const str = JSON.stringify(bsPage);
        if (str.includes('EAAM') || str.includes('token')) {
            console.log("  >>> FOUND TOKEN FIELD! <<<");
        }
    }
    
    // 3. Try Pancake's page_access_token as FB token directly
    console.log("\n\n=== 3. Test Pancake page_access_token as FB Send API ===");
    const sendUrl = `https://graph.facebook.com/v21.0/me/messages`;
    const sendBody = {
        recipient: { id: "26120187510970091" },
        message: { text: "Test" },
        messaging_type: "MESSAGE_TAG",
        tag: "HUMAN_AGENT",
        access_token: pageToken,
    };
    const sendRes = await sf(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendBody),
    });
    console.log(`FB Send API with Pancake token: ${JSON.stringify(sendRes.data).slice(0, 300)}`);
    
    // 4. Try CRM token as FB token
    console.log("\n=== 4. Test CRM token on FB Graph API ===");
    const meRes = await sf(`https://graph.facebook.com/v21.0/me?access_token=${CRM_TOKEN}`);
    console.log(`FB /me with CRM token: ${JSON.stringify(meRes.data).slice(0, 200)}`);
}

main().catch(console.error);
