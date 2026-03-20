import { NextRequest, NextResponse } from "next/server";
import { TAlphaAdsModel } from "@/lib/bigquery/models/talpha-ads.model";
import { GoogleSheetsSyncService } from "@/lib/google-sheets/services/talpha-sync.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("from_date") || new Date().toISOString().slice(0, 10);
    const toDate = searchParams.get("to_date") || fromDate;
    const mode = searchParams.get("mode");

    try {
        if (mode === "test") {
            const config = TAlphaAdsModel.loadConfig();
            return NextResponse.json({
                success: true,
                message: "TALPHA V5.1 API CONNECTION OK",
                details: {
                    meta_ads: `${config.meta_ads.ad_account_ids.length} Accounts Connected`,
                    pos_cake: `${config.poscake.shops.length} Shops Connected`,
                    report_range: "March 2026+"
                }
            });
        }

        const { ads, catalog } = await TAlphaAdsModel.fetchMetaAds(fromDate, toDate);
        const orders = await TAlphaAdsModel.fetchPOSHybrid(fromDate, toDate);
        const result = TAlphaAdsModel.aggregate(ads, orders, catalog);

        return NextResponse.json({
            success: true,
            ...result,
            date: fromDate,
            from_date: fromDate,
            to_date: toDate
        });
    } catch (error: any) {
        console.error("API ROUTE ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { date, sheet_id } = body;

        if (!date || !sheet_id) {
            return NextResponse.json({ success: false, error: "Missing date or sheet_id" }, { status: 400 });
        }

        const { ads, catalog } = await TAlphaAdsModel.fetchMetaAds(date, date);
        const orders = await TAlphaAdsModel.fetchPOSHybrid(date, date);
        const result = TAlphaAdsModel.aggregate(ads, orders, catalog);

        const syncService = new GoogleSheetsSyncService(sheet_id);
        const syncedData = await syncService.syncAdsData({
            date,
            ...result
        });

        return NextResponse.json({
            success: true,
            message: "Sync Successful to '2026 auto'",
            data: syncedData
        });
    } catch (error: any) {
        console.error("POST SYNC ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
