import { NextRequest, NextResponse } from "next/server";
import { GoogleSheetsSyncService } from "@/lib/google-sheets/services/talpha-sync.service";

/* 
 * API: /api/cron/broadcast-fire
 * Description: Vercel Cron endpoint to run every 15 minutes.
 * Parses Google Sheets schedules, checks if any segment is due, and fires `/api/broadcast`.
 */

export const maxDuration = 300; // Allow maximum 5 minutes for processing sending batches
export const dynamic = "force-dynamic";

const SHEET_ID = "1-kY-bLJUYS_PPogDVydY1T330D67Cj2RK8lF8E1rzoI";

// Hardcode SHOP_TIMEZONES to avoid importing client-component
const SHOP_TIMEZONES: Record<string, { offset: number; label: string; flag: string }> = {
    "Saudi": { offset: 3, label: "UTC+3", flag: "🇸🇦" },
    "UAE": { offset: 4, label: "UTC+4", flag: "🇦🇪" },
    "Kuwait": { offset: 3, label: "UTC+3", flag: "🇰🇼" },
    "Oman": { offset: 4, label: "UTC+4", flag: "🇴🇲" },
    "Qatar": { offset: 3, label: "UTC+3", flag: "🇶🇦" },
    "Bahrain": { offset: 3, label: "UTC+3", flag: "🇧🇭" },
    "Japan": { offset: 9, label: "UTC+9", flag: "🇯🇵" },
    "Taiwan": { offset: 8, label: "UTC+8", flag: "🇹🇼" },
};

function getTodayDateStr(utcOffset: number): string {
    const now = new Date();
    const target = new Date(now.getTime() + utcOffset * 3600000 + now.getTimezoneOffset() * 60000);
    return target.toISOString().slice(0, 10);
}

function calcNextFireAt(hour: number, utcOffset: number): string {
    const now = new Date();
    const target = new Date(now.getTime() + utcOffset * 3600000 + now.getTimezoneOffset() * 60000);
    target.setHours(hour, 0, 0, 0);
    if (target.getTime() < now.getTime()) {
        target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
}

export async function GET(req: NextRequest) {
    try {
        console.log("[cron/broadcast-fire] Starting execution...");
        const syncService = new GoogleSheetsSyncService(SHEET_ID);
        const schedules = await syncService.readBroadcastState();
        if (!schedules || schedules.length === 0) {
            return NextResponse.json({ success: true, message: "No schedules found" });
        }

        let hasUpdates = false;

        for (const schedule of schedules) {
            if (!schedule.isActive || !schedule.segments?.length) continue;
            const tz = SHOP_TIMEZONES[schedule.shopName]?.offset ?? 3;
            const todayStr = getTodayDateStr(tz);
            const now = new Date();
            const targetNow = new Date(now.getTime() + tz * 3600000 + now.getTimezoneOffset() * 60000);
            const currentDecimal = targetNow.getHours() + targetNow.getMinutes() / 60;

            for (const seg of schedule.segments) {
                // Đã chạy hôm nay rồi?
                if (seg.status === 'sent' && schedule.lastRunDate === todayStr) continue;
                
                // Do chúng ta chạy Server-side Cron nên bỏ qua lỗi lock 'sending'. 
                // Xoá bỏ check `if (seg.status === 'sending') continue;` để nếu tạch dở dang thì được gửi lại.

                // Reset status nếu sang ngày mới
                if (schedule.lastRunDate && schedule.lastRunDate !== todayStr) {
                    seg.status = 'pending';
                    seg.error = undefined;
                    seg.sentAt = undefined;
                }

                // Đã đến giờ? → fire
                if (currentDecimal >= seg.hour && seg.status !== 'sent') {
                    console.log(`[cron/broadcast-fire] Firing schedule ${schedule.id} seg ${seg.hour}h`);
                    seg.status = 'sending';
                    schedule.lastRunDate = todayStr;
                    hasUpdates = true;
                    // LƯU TRẠNG THÁI "ĐANG GỬI"
                    await syncService.writeBroadcastState(schedules);

                    try {
                        const host = req.nextUrl.origin;
                        const custRes = await fetch(`${host}/api/broadcast?shopId=${schedule.shopId}&pageFilter=${schedule.pageId}`);
                        const custData = await custRes.json();
                        let allCust: any[] = custData.customers || [];

                        // ═══ ÁP DỤNG FILTER TỪ LỊCH — loại khách đã mua ═══
                        if (schedule.filterPurchase === 'no_purchase') {
                            const PURCHASE_TAGS = ['đã gửi', 'đã nhận', 'da gui', 'da nhan', 'mua hàng', 'mua hang', 'đã mua', 'da mua', 'shipped', 'delivered'];
                            allCust = allCust.filter((c: any) => {
                                if (c.customerPhone || c.orderCount > 0) return false;
                                const tagStr = (c.tags || []).map((t: any) => String(t).toLowerCase()).join(' ');
                                if (PURCHASE_TAGS.some(pt => tagStr.includes(pt))) return false;
                                return true;
                            });
                        } else if (schedule.filterPurchase === 'has_purchase') {
                            allCust = allCust.filter((c: any) => c.customerPhone || c.orderCount > 0);
                        }

                        const recipients = allCust.map((c: any) => ({
                            psid: c.psid,
                            pageFbId: c.pageFbId,
                            name: c.customerName,
                            conversationId: c.id,
                        }));

                        if (recipients.length === 0) {
                            seg.status = 'error';
                            seg.error = 'Không có khách hàng phù hợp';
                        } else {
                            let successCount = 0;
                            let errorCount = 0;
                            
                            // Gửi batch POST (hạn chế limit / timeout)
                            // To prevent hitting 5min timeout, we can process them sequentially
                            for (let i = 0; i < recipients.length; i++) {
                                try {
                                    const res = await fetch(`${host}/api/broadcast`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            recipients: [recipients[i]],
                                            message: seg.message,
                                            forceGraphAPI: true,
                                        }),
                                    });
                                    const data = await res.json();
                                    if (data.results?.[0]?.success) successCount++;
                                    else errorCount++;
                                } catch {
                                    errorCount++;
                                }
                                // Delay 300ms 
                                if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 300));
                            }

                            if (errorCount === 0) {
                                seg.status = 'sent';
                                seg.sentAt = new Date().toISOString();
                                if (!schedule.firedDates) schedule.firedDates = [];
                                if (!schedule.firedDates.includes(todayStr)) schedule.firedDates.push(todayStr);
                            } else if (successCount > 0) {
                                seg.status = 'sent';
                                seg.sentAt = new Date().toISOString();
                                seg.error = `${errorCount} lỗi / ${recipients.length} tổng`;
                                if (!schedule.firedDates) schedule.firedDates = [];
                                if (!schedule.firedDates.includes(todayStr)) schedule.firedDates.push(todayStr);
                            } else {
                                seg.status = 'error';
                                seg.error = `Tất cả ${errorCount} gửi thất bại`;
                            }
                        }

                        schedule.lastFiredAt = new Date().toISOString();
                        schedule.nextFireAt = calcNextFireAt(seg.hour, tz);
                        hasUpdates = true;
                    } catch (err: any) {
                        seg.status = 'error';
                        seg.error = err instanceof Error ? err.message : 'Unknown error';
                        hasUpdates = true;
                    }
                }
            }
        }

        if (hasUpdates) {
            await syncService.writeBroadcastState(schedules);
            console.log("[cron/broadcast-fire] Finished and updated schedules.");
        } else {
            console.log("[cron/broadcast-fire] No segments due for firing.");
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[cron/broadcast-fire] ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
