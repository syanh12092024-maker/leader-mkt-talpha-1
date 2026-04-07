import { NextRequest, NextResponse } from "next/server";
import { GoogleSheetsSyncService } from "@/lib/google-sheets/services/talpha-sync.service";

/* 
 * API: /api/schedules
 * Description: Stores and retrieves broadcast schedules using a hidden Google Sheets tab.
 */

// We use the same sheet_id used by the ads command center for simplicity.
const SHEET_ID = "1-kY-bLJUYS_PPogDVydY1T330D67Cj2RK8lF8E1rzoI";

export async function GET() {
    try {
        const syncService = new GoogleSheetsSyncService(SHEET_ID);
        const schedules = await syncService.readBroadcastState();
        return NextResponse.json({ success: true, schedules });
    } catch (error: any) {
        console.error("GET SCHEDULES ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!Array.isArray(body)) {
            return NextResponse.json({ success: false, error: "Body must be an array of schedules" }, { status: 400 });
        }

        const syncService = new GoogleSheetsSyncService(SHEET_ID);
        await syncService.writeBroadcastState(body);
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("POST SCHEDULES ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
