import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import path from "path";

export class GoogleSheetsSyncService {
    private doc: GoogleSpreadsheet;

    constructor(sheetId: string) {
        const keyPath = path.resolve(process.cwd(), "../Agentic-AI-Levelup/config/bigquery-key.json");
        const creds = require(keyPath);

        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        this.doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    }

    async syncAdsData(data: any) {
        try {
            await this.doc.loadInfo();

            // 1. Get or Create "2026 auto" tab
            let sheet = this.doc.sheetsByTitle["2026 auto"];
            if (!sheet) {
                sheet = await this.doc.addSheet({
                    title: "2026 auto",
                    headerValues: [
                        "30", "TỔNG TIỀN ADS", "SỐ TIN NHẮN", "Giá Tiền/TN", "CPO",
                        "Tỷ lệ chốt", "Số đơn", "AED", "Tỉ giá AED", "Doanh Số",
                        "Doanh số ship thành công dự kiến", "tỷ lệ Chi phí ads/Doanh Thu",
                        "tỷ lệ Chi phí ads/Thu ship thành", "TB đơn"
                    ]
                });
            }

            // 2. Validate date (March 2026+)
            const syncDate = new Date(data.date);
            const marchFirst = new Date("2026-03-01");
            if (syncDate < marchFirst) {
                throw new Error("Hệ thống chỉ đồng bộ dữ liệu từ tháng 3/2026 trở đi.");
            }

            // 3. Format Row
            const AED_RATE = 7010; // Updated from yaml
            const SUCCESS_RATE = 0.65;

            const row = {
                "30": data.date,
                "TỔNG TIỀN ADS": data.total_spend,
                "SỐ TIN NHẮN": data.total_messages,
                "Giá Tiền/TN": data.total_messages > 0 ? Math.round(data.total_spend / data.total_messages) : 0,
                "CPO": data.total_orders > 0 ? Math.round(data.total_spend / data.total_orders) : 0,
                "Tỷ lệ chốt": data.total_messages > 0 ? (data.total_orders / data.total_messages).toFixed(4) : 0,
                "Số đơn": data.total_orders,
                "AED": Math.round(data.total_spend / AED_RATE),
                "Tỉ giá AED": AED_RATE,
                "Doanh Số": data.total_revenue,
                "Doanh số ship thành công dự kiến": Math.round(data.total_revenue * SUCCESS_RATE),
                "tỷ lệ Chi phí ads/Doanh Thu": data.total_revenue > 0 ? (data.total_spend / data.total_revenue).toFixed(4) : 0,
                "tỷ lệ Chi phí ads/Thu ship thành": (data.total_revenue * SUCCESS_RATE) > 0 ? (data.total_spend / (data.total_revenue * SUCCESS_RATE)).toFixed(4) : 0,
                "TB đơn": data.total_orders > 0 ? Math.round(data.total_revenue / data.total_orders) : 0,
            };

            await sheet.addRow(row);
            return row;
        } catch (err: any) {
            console.error("Sheet Sync Error:", err.message);
            throw err;
        }
    }
}
