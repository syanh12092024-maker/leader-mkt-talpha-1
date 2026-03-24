import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// Debug: test send message on 2 pages to compare error responses
export async function GET(req: NextRequest) {
    // Load CRM token
    const configPath = path.join(process.cwd(), "config", "script-generator.yaml");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = yaml.load(raw) as { pancake_crm?: { api_token: string } };
    const crmToken = config.pancake_crm?.api_token;
    if (!crmToken) return NextResponse.json({ error: "No CRM token" });

    const PAGES = [
        { id: "1051443131380491", name: "Ginger Patch - Taiwan" },
        { id: "1079273301926933", name: "Brightening Soap Store - Taiwan" },
    ];

    const results: Record<string, unknown>[] = [];

    for (const page of PAGES) {
        const entry: Record<string, unknown> = { page: page.name, pageId: page.id };

        // 1. Gen page token
        const tokenRes = await fetch(
            `https://pages.fm/api/v1/pages/${page.id}/generate_page_access_token?access_token=${crmToken}`,
            { method: "POST" }
        );
        const tokenData = await tokenRes.json().catch(() => ({}));
        const pageToken = tokenData.page_access_token;
        entry.tokenStatus = pageToken ? "OK" : "FAILED";
        entry.tokenError = pageToken ? null : tokenData;

        if (!pageToken) { results.push(entry); continue; }

        // 2. Get conversations (first 3 sorted by last message)
        const convoUrl = `https://pages.fm/api/public_api/v1/pages/${page.id}/conversations?page_access_token=${pageToken}&limit=5`;
        const convoRes = await fetch(convoUrl);
        const convoData = await convoRes.json().catch(() => ({}));
        const convos = convoData?.conversations || convoData?.data || [];
        entry.conversationCount = convos.length;

        // Show customer info
        entry.customers = convos.slice(0, 3).map((c: Record<string, unknown>) => ({
            id: c.id,
            name: c.customer_name || c.name,
            lastMessage: c.last_message_at || c.updated_at,
            psid: c.from_id || c.customer_id,
        }));

        // 3. Try to send a test message to the FIRST conversation (dry run - just check the params we send)
        if (convos.length > 0) {
            const testConvo = convos[0];
            const convoId = testConvo.id;
            const apiBase = `https://pages.fm/api/public_api/v1/pages/${page.id}/conversations/${convoId}/messages?page_access_token=${pageToken}`;

            // Test 1: plain reply_inbox (no tag)
            const test1Res = await fetch(apiBase, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "reply_inbox",
                    message: "🔔 Test message from broadcast system",
                }),
            });
            const test1Data = await test1Res.json().catch(() => ({}));
            entry.test_noTag = {
                success: test1Data.success,
                error: test1Data.original_error || test1Data.message || null,
                errorCode: test1Data.error_code || null,
            };

            // Test 2: with HUMAN_AGENT tag
            const test2Res = await fetch(apiBase, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "reply_inbox",
                    message: "🔔 Test with HUMAN_AGENT tag",
                    messaging_type: "MESSAGE_TAG",
                    tag: "HUMAN_AGENT",
                }),
            });
            const test2Data = await test2Res.json().catch(() => ({}));
            entry.test_humanAgent = {
                success: test2Data.success,
                error: test2Data.original_error || test2Data.message || null,
                errorCode: test2Data.error_code || null,
            };
        }

        results.push(entry);
    }

    return NextResponse.json({ results }, { status: 200 });
}
