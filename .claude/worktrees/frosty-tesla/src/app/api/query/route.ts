import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 });
        }

        // Basic SQL injection guard — only allow SELECT queries
        const trimmed = query.trim().toUpperCase();
        if (!trimmed.startsWith("SELECT")) {
            return NextResponse.json({ error: "Only SELECT queries allowed" }, { status: 403 });
        }

        const data = await runQuery(query);
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("BigQuery /api/query error:", error?.message || error);
        return NextResponse.json(
            { error: error?.message || "Query failed", data: [] },
            { status: 500 }
        );
    }
}
