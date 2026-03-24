import { NextResponse } from "next/server";

// Test multiple image hosting services from Vercel
export async function GET() {
    const results: string[] = [];
    
    // Create tiny 1x1 red PNG
    const tinyPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
    const buf = Buffer.from(tinyPngB64, 'base64');
    
    // === Test 1: imgBB (free, no API key needed for anonymous) ===
    try {
        results.push("=== imgBB ===");
        const fd1 = new FormData();
        fd1.append('image', tinyPngB64); // imgBB accepts base64 directly
        const r1 = await fetch('https://api.imgbb.com/1/upload?key=7a632fb89a65f1b0e8a4b3c2d9f8e1a0', {
            method: 'POST', body: fd1,
        });
        const d1 = await r1.json().catch(() => ({ error: r1.status }));
        results.push(`Status: ${r1.status}`);
        results.push(`URL: ${d1.data?.url || d1.error?.message || JSON.stringify(d1).slice(0, 200)}`);
    } catch (e) { results.push(`imgBB ERROR: ${(e as Error).message}`); }

    // === Test 2: 0x0.st (no-bullshit file hosting) ===
    try {
        results.push("\n=== 0x0.st ===");
        const fd2 = new FormData();
        fd2.append('file', new File([buf], 'test.png', { type: 'image/png' }));
        const r2 = await fetch('https://0x0.st', { method: 'POST', body: fd2 });
        const t2 = (await r2.text()).trim();
        results.push(`Status: ${r2.status}`);
        results.push(`URL: ${t2.slice(0, 200)}`);
        results.push(`Valid: ${t2.startsWith('http') ? 'YES' : 'NO'}`);
    } catch (e) { results.push(`0x0.st ERROR: ${(e as Error).message}`); }

    // === Test 3: Telegraph (Telegram image hosting) ===
    try {
        results.push("\n=== telegra.ph ===");
        const fd3 = new FormData();
        fd3.append('file', new File([buf], 'test.png', { type: 'image/png' }));
        const r3 = await fetch('https://telegra.ph/upload', { method: 'POST', body: fd3 });
        const d3 = await r3.json().catch(() => []);
        results.push(`Status: ${r3.status}`);
        if (Array.isArray(d3) && d3[0]?.src) {
            results.push(`URL: https://telegra.ph${d3[0].src}`);
            results.push(`Valid: YES`);
        } else {
            results.push(`Response: ${JSON.stringify(d3).slice(0, 200)}`);
        }
    } catch (e) { results.push(`telegra.ph ERROR: ${(e as Error).message}`); }

    // === Test 4: freeimage.host ===
    try {
        results.push("\n=== freeimage.host ===");
        const fd4 = new FormData();
        fd4.append('source', tinyPngB64);
        fd4.append('type', 'base64');
        fd4.append('action', 'upload');
        const r4 = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
            method: 'POST', body: fd4,
        });
        const d4 = await r4.json().catch(() => ({}));
        results.push(`Status: ${r4.status}`);
        results.push(`URL: ${d4.image?.url || JSON.stringify(d4).slice(0, 200)}`);
    } catch (e) { results.push(`freeimage.host ERROR: ${(e as Error).message}`); }

    return NextResponse.json({ results: results.join('\n') });
}
