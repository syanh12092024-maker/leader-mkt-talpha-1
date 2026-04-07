# 🗓️ Roadmap Triển Khai AI — Flow Hàng

## Phase 1: Quick Wins (Tuần 1-2)
> **Mục tiêu:** Làm ngay, thấy kết quả ngay, không cần technical deep

### Sprint 1A: Auto-Status Column
- [ ] Thêm cột `STATUS` dùng Google Sheets formula
- [ ] Thêm cột `DELAY_DAYS` = ngày ETA - ngày Actual (nếu có)
- [ ] Color coding tự động qua Conditional Formatting (thay vì thủ công)

**Code mẫu Apps Script:**
```javascript
function autoUpdateStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TỔNG từ TQ");
  const lastRow = sheet.getLastRow();
  
  for (let i = 2; i <= lastRow; i++) {
    const datPaid = sheet.getRange(i, 13).getValue();  // Ngày tt cho NCC
    const factoryShip = sheet.getRange(i, 14).getValue(); // Ngày nhà máy gửi
    const arrivedDest1 = sheet.getRange(i, 15).getValue(); // Ngày về kho 1
    
    let status = "📝 Mới đề xuất";
    if (datPaid) status = "⏳ Chờ nhà máy";
    if (factoryShip) status = "🚢 Đang vận chuyển";
    if (arrivedDest1) status = "✅ Đã về kho đích";
    
    sheet.getRange(i, 20).setValue(status); // Ghi vào cột T
  }
}
```

### Sprint 1B: Basic Alert
- [ ] Setup daily email digest: "Danh sách lô hàng ETA trong 3 ngày tới"
- [ ] Setup alert: "Lô hàng đã quá ETA chưa về"

---

## Phase 2: Intelligence Layer (Tuần 3-6)

### Sprint 2A: Lead Time Dashboard
- [ ] Tạo sheet "ANALYTICS" trong cùng file Sheets
- [ ] QUERY formula tính avg lead time by: NCC, Tuyến, Hình thức VC
- [ ] Pivot table: Lead time by month (có hay không theo mùa?)

### Sprint 2B: Financial Cross-reference
- [ ] Chuẩn hóa Mã SKU làm primary key xuyên suốt 5 sheets
- [ ] VLOOKUP / XLOOKUP để ghép tài chính với logistics
- [ ] Tạo view "Vốn đang trên đường" by thị trường

---

## Phase 3: Real-time Automation (Tháng 2-3)

### Sprint 3A: External Data Integration
- [ ] Tích hợp tracking API (17track, AfterShip) → auto-fill actual arrival dates
- [ ] Không cần nhập tay tracking status nữa

### Sprint 3B: Looker Studio Dashboard
- [ ] Connect Google Sheets → Looker Studio
- [ ] Build visualizations: Pipeline view, Delay heat map, NCC performance
- [ ] Share với toàn team: chỉ xem không cần vào Sheets

### Sprint 3C: Zalo/Telegram Bot
- [ ] Bot gửi daily summary vào group
- [ ] Bot alert khi có delay, hàng về kho
- [ ] Bot trả lời query: "Lô UAE đang ở đâu?"

---

## Phase 4: AI Predictive Layer (Tháng 4+)

### Sprint 4A: Demand Forecasting
- [ ] Kết hợp dữ liệu bán hàng (từ POS/ads) với lịch sử nhập hàng
- [ ] AI gợi ý: "Tháng tới nên nhập bao nhiêu unit cho mỗi thị trường"

### Sprint 4B: Supplier Intelligence
- [ ] Score NCC theo: % on-time, % quality issue, avg lead time
- [ ] AI đề xuất: "Nên diversify NCC cho SKU này"

---

## Bắt đầu từ đâu?

**Câu trả lời: Phase 1, Sprint 1A — ngay hôm nay.**

1. Tôi có thể viết Google Apps Script tự động cho sheet của bạn
2. Chạy test trên 1 tab trước
3. Roll out cho toàn bộ nếu OK

**Cần confirm từ bạn:**
- Cột nào đang là "Ngày về kho đích" (cột mấy trong sheet)?
- Muốn alert qua Email hay Zalo?
- Ai là người dùng chính của file này?
