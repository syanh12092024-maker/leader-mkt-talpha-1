import { NextResponse } from "next/server";

// Debug endpoint: test Litterbox upload + Pancake send
export async function GET() {
    const results: string[] = [];
    
    try {
        // 1. Test Litterbox upload with 1x1 pixel PNG
        results.push("=== Step 1: Litterbox Upload ===");
        const tinyPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
        const buf = Buffer.from(tinyPngB64, 'base64');
        const file = new File([buf], 'test.png', { type: 'image/png' });
        
        const fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('time', '72h');
        fd.append('fileToUpload', file);
        
        const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST',
            body: fd,
        });
        const status = uploadRes.status;
        const uploadText = (await uploadRes.text()).trim();
        results.push(`Status: ${status}`);
        results.push(`Response: ${uploadText}`);
        results.push(`Valid URL: ${uploadText.startsWith('http') ? 'YES' : 'NO'}`);
        
        // 2. If Litterbox works, test sending URL via Pancake
        if (uploadText.startsWith('http')) {
            results.push("\n=== Step 2: Pancake send test (dry run) ===");
            results.push(`Would send URL: ${uploadText}`);
            results.push("Skipping actual send (no recipient)");
        }
        
        return NextResponse.json({ success: true, results: results.join('\n') });
    } catch (err) {
        results.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
        results.push(`Stack: ${err instanceof Error ? err.stack?.slice(0, 300) : 'N/A'}`);
        return NextResponse.json({ success: false, results: results.join('\n') }, { status: 500 });
    }
}
