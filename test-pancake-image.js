// Re-check: does the token now see pages after admin grant?
const TOKEN = "EAAMAZBn3DH6gBRKd4KAuDt7ezvAthYKVkQ9bZAl7iiqkWcrxCn1t791tsVcAcz1uKKAW6MAT6x3TGaeBbyigtRUCxQYUSZBZCBtJbOf2xzlykHJbhseAmWsjySWZAZCCD9gROkGwD1ZBOveG3C1ZAosedBwnnU2sKZAieVlDXufvTQWugoetBBldSZCal2jR4G2hWZCjlazn3ERNHDkdUqbrZCri3VWGNBGafYdorps5DIFXXhIg7d8CFfHXtMR3UGZA1EchcZAHZAwUIF8gA1euh2CwJxjj6WU";

async function sf(url) { return (await fetch(url)).json().catch(e => ({ _err: e.message })); }

async function main() {
    console.log("=== 1. Token Owner ===");
    const me = await sf(`https://graph.facebook.com/v25.0/me?access_token=${TOKEN}`);
    console.log(JSON.stringify(me));

    console.log("\n=== 2. Permissions ===");
    const perms = await sf(`https://graph.facebook.com/v25.0/me/permissions?access_token=${TOKEN}`);
    (perms.data || []).forEach(p => console.log(`  ${p.permission}: ${p.status}`));

    console.log("\n=== 3. Pages (ALL) ===");
    let url = `https://graph.facebook.com/v25.0/me/accounts?access_token=${TOKEN}&limit=100&fields=id,name,access_token`;
    const pages = [];
    while (url) {
        const data = await sf(url);
        if (data.data) pages.push(...data.data);
        else { console.log("  Error:", JSON.stringify(data)); break; }
        url = data.paging?.next || '';
    }
    console.log(`  Total: ${pages.length} pages`);
    pages.forEach(p => console.log(`  ${p.id} → ${p.name} (token: ${p.access_token ? '✅' : '❌'})`));

    // Match with Pancake
    if (pages.length > 0) {
        console.log("\n=== 4. Match Pancake Taiwan ===");
        const tw = await sf("https://pos.pages.fm/api/v1/shops/1328343252?api_key=1d5e719041a34861be0076cdb26f9688");
        const pkPages = tw?.shop?.pages || [];
        for (const pk of pkPages.slice(0, 5)) {
            const match = pages.find(fb => {
                const fn = (fb.name || '').toLowerCase();
                const pn = (pk.name || '').toLowerCase();
                return fn === pn || fn.includes(pn) || pn.includes(fn);
            });
            console.log(`  PK:${pk.id} "${pk.name}" → ${match ? `✅ FB:${match.id}` : '❌'}`);
        }
    }
}
main().catch(console.error);
