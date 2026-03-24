// Quick test: verify Facebook Graph API access + page token generation
const META_TOKEN = "EAAM3CbrTmZBwBQtZAZCCbrRHxre3uvjCVAnA9vBPTUVoCXoIt5UtDrHRzMfS4YKqPLNUEqr0BnzUhUVgU2sFR1HT0LJjmclOZA6GsNxZAUFKY0a215H8J6ZAr8NZBOsvkOfCoeDv18DxL8JeY259AepFiTjWcQu50PvbyElwVMrBsWPs24J2SgFkxh2LIqwZCYHD";
const CRM_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbmZvIjp7Im9zIjoxLCJjbGllbnRfaXAiOiIxLjUyLjIzMi4xODIiLCJicm93c2VyIjoxLCJkZXZpY2VfdHlwZSI6M30sIm5hbWUiOiJT4bu5IEFuaCIsImV4cCI6MTc4MTY2MzQ0NCwiYXBwbGljYXRpb24iOjEsInVpZCI6IjQxMjUxMzliLTFhNGItNDBjMS04MjQwLWNhYjYwYTRlODFiMSIsInNlc3Npb25faWQiOiJkZTEzODAxYy0zMzY5LTQ4M2EtODY4Zi1hZjc0MTc5NzRkMjMiLCJpYXQiOjE3NzM4ODc0NDQsImZiX2lkIjoiNzQ5NjM4MzA0NzMyMjM5IiwibG9naW5fc2Vzc2lvbiI6bnVsbCwiZmJfbmFtZSI6IlPhu7kgQW5oIn0.8K5HfAn39PSObxzlkHicjua4EXVRL3IjVq8Sy_xHhw8";

async function sf(url, opts) {
    const r = await fetch(url, opts);
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { _raw: t.slice(0, 500), _s: r.status }; }
}

async function main() {
    // 1. Verify Meta token is valid
    console.log("=== 1. Check Meta token ===");
    const me = await sf(`https://graph.facebook.com/v21.0/me?access_token=${META_TOKEN}`);
    console.log("Me:", JSON.stringify(me));
    
    // 2. Get all pages this user manages
    console.log("\n=== 2. List managed pages ===");
    const pages = await sf(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}&limit=5`);
    console.log("Pages:", JSON.stringify(pages).slice(0, 500));
    
    // 3. Get Taiwan page from POSCake
    console.log("\n=== 3. Get Taiwan pages from POSCake ===");
    const shop = await sf(`https://pos.pages.fm/api/v1/shops/1328343252?api_key=1d5e719041a34861be0076cdb26f9688`);
    const twPages = shop?.shop?.pages || [];
    console.log("Pancake page IDs:", twPages.map(p => `${p.id}:${p.name}`).join(', '));
    
    // 4. Try gen FB page token for Pancake page IDs
    if (twPages.length > 0) {
        const pancakePageId = String(twPages[0].id);
        console.log(`\n=== 4. Try FB token for Pancake pageId: ${pancakePageId} ===`);
        const fbToken = await sf(`https://graph.facebook.com/v21.0/${pancakePageId}?fields=access_token&access_token=${META_TOKEN}`);
        console.log("Result:", JSON.stringify(fbToken).slice(0, 300));
    }

    // 5. If pages from /me/accounts exist, try with those IDs
    if (pages.data?.length > 0) {
        const fbPage = pages.data[0];
        console.log(`\n=== 5. Try FB page from /me/accounts: ${fbPage.id}:${fbPage.name} ===`);
        console.log("Token exists:", !!fbPage.access_token);
        
        // Try to get conversations for this page via Pancake
        console.log(`\n=== 6. Gen Pancake token for FB page ${fbPage.id} ===`);
        const pancakeToken = await sf(
            `https://pages.fm/api/public_api/v1/pages/${fbPage.id}/gen_page_access_token`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_token: CRM_TOKEN }) }
        );
        console.log("Pancake token:", JSON.stringify(pancakeToken).slice(0, 200));
    }
}

main().catch(console.error);
