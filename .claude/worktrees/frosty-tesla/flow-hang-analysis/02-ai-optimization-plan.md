# 🤖 AI Optimization Plan — Flow Hàng LEADER MKT TALPHA

> Dựa trên phân tích 5 sheets Google Sheets hiện tại

---

## Module 1: AI Auto-Status (Ưu tiên cao nhất)

### Vấn đề giải quyết
Hiện tại team phải đọc nhiều cột, nhìn màu sắc để biết lô hàng đang ở đâu. Mỗi ngày tốn 1-2h chỉ để "nhìn qua" file.

### Giải pháp AI
**Cột `STATUS` tự động được tính theo logic:**

```
AUTO_STATUS = 
  IF(ngay_ve_kho_dich_1_actual ≠ empty) → "✅ Đã về kho đích"
  ELSE IF(ngay_nha_may_gui_hang ≠ empty) → "🚢 Đang vận chuyển"
  ELSE IF(ngay_tt_cho_nha_cc ≠ empty) → "⏳ Chờ nhà máy giao"
  ELSE IF(ngay_dat_hang ≠ empty) → "📋 Đã đặt hàng"
  ELSE → "📝 Mới đề xuất"
```

**→ Dùng Google Apps Script, chạy tự động mỗi 1 giờ**

### Lợi ích
- Tiết kiệm: ~1h/ngày cho team
- Không cần color coding thủ công
- Có thể filter/sort theo trạng thái

---

## Module 2: AI Lead Time Intelligence

### Vấn đề giải quyết
Không biết trung bình một lô hàng từ TQ về UAE mất bao lâu → không lên kế hoạch nhập được chính xác → hết hàng hoặc tồn kho quá nhiều.

### Giải pháp AI
**Tự động tính lead time theo từng segment:**

```
LEAD_TIME_ANALYSIS:
  ├── NCC → nhà máy gửi hàng: X ngày (avg by NCC)
  ├── Gửi → về kho đích: Y ngày (avg by tuyến + hình thức VC)
  └── Tổng: Z ngày (avg by country + shipping method)
```

**Output gợi ý:**
- "NCC A trung bình delay 3 ngày so với cam kết"
- "Air shipping UAE trung bình 12 ngày, Sea 28 ngày"
- "Nên đặt hàng UAE trước 35 ngày để an toàn"

### Implementation
- Google Sheets QUERY/ARRAYFORMULA hoặc Apps Script
- Có thể build dashboard bằng Looker Studio (free)

---

## Module 3: AI Early Warning System (Cảnh báo sớm)

### Kịch bản cảnh báo tự động

| Kịch bản | Trigger | Action |
|---------|---------|--------|
| Hàng chậm | Ngày ETA đã qua mà chưa có actual | Email/Zalo notify team |
| Stock sắp hết | Tồn kho < threshold | Auto-alert MKT phụ trách |
| NCC chưa gửi | Sau ngày đặt 7 ngày chưa có tracking | Ping MKT báo NCC |
| Thanh toán pending | Đặt hàng mà chưa có ngày tt cho NCC 3+ ngày | Alert cần chuyển tiền |

### Implementation
- Google Apps Script + time-based trigger
- Gửi qua Gmail hoặc Webhook Zalo/Telegram

---

## Module 4: AI Financial Intelligence

### Vấn đề
Sheet tài chính (Trang tính2) tách biệt với sheet logistics → không biết:
- Tổng chi phí hàng theo thị trường?
- Chi phí vận chuyển / unit là bao nhiêu?
- Thị trường nào đang hao vốn nhiều nhất chờ hàng?

### Giải pháp
**Báo cáo tổng hợp tự động:**

```
PER MARKET SUMMARY (tính tự động):
├── UAE: 
│   ├── Tổng vốn hàng đang trên tàu: XXX USD
│   ├── Tổng hàng đã về kho: XXX units
│   └── Avg cost/unit: XXX
├── Saudi Arabia: ...
└── Úc: ...
```

**Tương đương "Working Capital by Market" — CFO-level insight từ một file Sheets**

---

## Module 5: AI SKU Performance Tracker

### Vấn đề
Không biết SKU nào đang nhập nhiều nhất? SKU nào hay bị delay? SKU nào nhiều lần phải chuyển kho?

### Giải pháp
**Cross-sheet analysis theo SKU:**

```
SKU_REPORT:
├── Mã SKU: ACWL25111401
├── Lần nhập: 5 lần
├── Thị trường nhập: Úc, UAE
├── Avg lead time: 22 ngày
├── Tỷ lệ delay: 40% (2/5 lần)
└── Tổng số lượng đã nhập: 1,000 units
```

---

## Module 6: AI Google Sheets → Automation Hub

### Kiến trúc đề xuất

```
Google Sheets (data entry)
    ↓ Apps Script sync
Google BigQuery / Sheets Aggregator
    ↓
Looker Studio Dashboard (visual)
    ↓
Zalo/Email Alerts (notification)
```

**Hoặc đơn giản hơn:**
```
Google Sheets
    ↓ Zapier / Make.com
Notion / Slack / Zalo notification
```

---

## Tóm tắt ROI dự kiến

| Module | Effort | Tiết kiệm thời gian | Giá trị business |
|--------|--------|---------------------|-----------------|
| Auto-Status | Thấp (1-2 ngày) | 1h/ngày | ⭐⭐⭐⭐⭐ |
| Early Warning | Thấp (1-2 ngày) | 30ph/ngày + tránh stockout | ⭐⭐⭐⭐⭐ |
| Lead Time Analytics | Trung bình (3-5 ngày) | Better planning | ⭐⭐⭐⭐ |
| Financial Intelligence | Trung bình (3-5 ngày) | Quản trị vốn tốt hơn | ⭐⭐⭐⭐ |
| SKU Tracker | Cao (1-2 tuần) | NCC negotiation power | ⭐⭐⭐ |
| Full Dashboard | Cao (2-4 tuần) | Executive visibility | ⭐⭐⭐ |
