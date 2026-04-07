# 📊 Phân Tích Hiện Trạng — Flow Hàng LEADER MKT TALPHA

## 1. Tổng quan quy trình hiện tại

### Vòng đời một lô hàng (as-is)
```
MKT đề xuất nhập
    ↓
Đặt hàng nhà cung cấp (NCC)
    ↓
NCC gửi hàng từ nhà máy
    ↓
Về kho trung gian (nếu có)
    ↓
Vận chuyển quốc tế
    ↓
Kho đích Thị trường 1
    ↓
Kho đích Thị trường 2 (transfer nội bộ)
    ↓
Phân phối / Chuyển kho
```

---

## 2. Cấu trúc dữ liệu — 5 Sheet hiện có

### Sheet 1: TỔNG từ TQ (Master Import Log)
**Mục đích:** Hub trung tâm theo dõi toàn bộ lô hàng nhập từ Trung Quốc

| Cột | Kiểu dữ liệu | Ghi chú |
|-----|-------------|---------|
| stt | Number | ID lô hàng |
| Quốc gia | Text | Thị trường đích (UAE, Saudi, Úc, USA...) |
| Hình thức vận chuyển | Text | Sea/Air/Express |
| MKT báo nhập | Text | MKT phụ trách |
| Đề xuất nhập | Date | Ngày đề xuất |
| Mã Tracking | Text | Tracking number |
| Mã SKU | Text | Mã sản phẩm |
| Mã đơn hàng dán lên kiện | Text/URL | Link 1688/Alibaba |
| Tên NCC | Text | Nhà cung cấp |
| Số lượng | Number | Số lượng đặt |
| Thuộc tính | Text | Màu, size... |
| Đặt hàng | Date | Ngày đặt hàng |
| Ngày tt cho nhà cc | Date | Thanh toán NCC |
| Ngày nhà máy gửi hàng | Date | Factory shipping |
| Ngày về kho đích 1 | Date | ETA & Actual |
| Ngày về kho đích 2 | Date | ETA & Actual |

**Vấn đề phát hiện:**
- ❌ Nhiều cột ẩn (I–P) → dữ liệu scattered, khó audit
- ❌ Tracking number nhập tay → prone to typo
- ❌ Không có cột trạng thái tổng hợp (pending/in-transit/arrived)
- ❌ Color coding thủ công → không scalable khi volume tăng

---

### Sheet 2: Chuyển kho (Internal Transfers)
**Mục đích:** Theo dõi di chuyển hàng giữa các kho

| Cột | Kiểu dữ liệu |
|-----|-------------|
| Quốc gia 1 (nguồn) | Text |
| Quốc gia 2 (đích) | Text |
| MKT báo chuyển | Text |
| DVVC (dịch vụ vận chuyển) | Text |
| Số lượng | Number |
| Ngày kho A chuyển | Date |
| Ngày về đích kho B | Date |

**Vấn đề phát hiện:**
- ❌ Không link được với sheet TỔNG → không trace được SKU cụ thể nào di chuyển
- ❌ Thiếu lý do chuyển kho (rebalance? tồn nhiều? hết hàng?)

---

### Sheet 3: Trang tính7 (Product Detail Tracking)
**Mục đích:** Chi tiết sản phẩm cụ thể (Mascara, Áo ngực, Kem...)

- Track theo từng variant (màu, size) đến từng thị trường
- Có ghi chú "Arrived March 11" → cập nhật thủ công
- Có hình ảnh sản phẩm

**Vấn đề:**
- ❌ Cấu trúc không chuẩn → khó tổng hợp tự động

---

### Sheet 4: Trang tính2 (Financial Log)
**Mục đích:** Theo dõi tài chính mua hàng

| Cột | Kiểu dữ liệu |
|-----|-------------|
| Ngày mua | Date |
| Tên sản phẩm | Text |
| Tiền hàng | Currency |
| Nước đích | Text |

- Có formula tính tổng tiền thanh toán
- **Vấn đề:** Tách biệt với sheet TỔNG → không tính được COGS per thị trường tự động

---

### Sheet 5: Trang tính6 (MKT-specific Log)
**Mục đích:** Log riêng của MKT (ví dụ: mkt.Lộc)

- Tracking notes chi tiết
- Có ghi chú "Tách lô" (split shipment)
- **Vấn đề:** Silo data, chỉ MKT đó dùng được

---

## 3. Điểm yếu tổng thể (Pain Points)

### 🔴 Critical
1. **Nhập liệu 100% thủ công** → bottleneck, error-prone
2. **Không có trạng thái thống nhất** → phải đọc nhiều cột để biết hàng đang ở đâu
3. **Không cảnh báo delay** → phải check hàng ngày theo cảm tính

### 🟡 Major  
4. **Data silo giữa các sheet** → không thể cross-reference SKU → financial → delivery
5. **Không tính được lead time trung bình** theo NCC, tuyến, hình thức vận chuyển
6. **Không phân tích được NCC nào delay nhiều** → không có data để negotiate

### 🟢 Minor
7. Color coding thủ công → mất thời gian maintenance
8. Không có audit log khi thay đổi dữ liệu
