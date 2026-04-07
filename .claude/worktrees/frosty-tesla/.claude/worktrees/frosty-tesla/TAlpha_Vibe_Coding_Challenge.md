# TALPHA — HỆ THỐNG QUẢN LÝ & TỰ ĐỘNG HOÁ MARKETING TOÀN DIỆN

**Cuộc thi:** Vibe Coding Challenge 2026 — Level Up Agency  
**Đội thi:** Pi Alpha — Tiểu Alpha Middle East  
**Thành viên:**  
- Lê Thị Diệu Thuý — Giám Đốc Pi Alpha  
- Nguyễn Thị Phương Anh  
- Hồ Sỹ Anh  
- Hồ Sỹ Lộc  
- Nguyễn Thị Hồng Ly  

**Sản phẩm:** TAlpha Dashboard  
**Link demo:** [https://talpha-dashboard.vercel.app/talpha](https://talpha-dashboard.vercel.app/talpha)  
**Công nghệ chính:** Next.js 14, React, TypeScript, Gemini AI, Facebook Graph API v21, Pancake CRM API

---

## 1. BỐI CẢNH & VẤN ĐỀ

### 1.1. Giới thiệu đội ngũ

Pi Alpha là đội Marketing phụ trách thị trường Middle East (UAE, KSA, Kuwait, Qatar, Bahrain, Oman) thuộc hệ thống Level Up Agency. Đội ngũ quản lý hàng chục Facebook Fanpage, phục vụ hàng ngàn khách hàng mỗi tháng với các sản phẩm chăm sóc sức khoẻ và làm đẹp. Quy trình hàng ngày bao gồm: tạo nội dung chào hàng, quản lý đơn nhập hàng từ nhà cung cấp (Trung Quốc → UAE → GCC), và gửi tin nhắn quảng bá tới khách hàng tiềm năng qua Facebook Messenger.

### 1.2. Ba nỗi đau lớn trước khi dùng AI

Trước khi xây dựng TAlpha, đội ngũ gặp phải 3 vấn đề nghiêm trọng ảnh hưởng trực tiếp đến doanh thu và hiệu suất:

**Nỗi đau #1 — Không bám sát được hàng đang ở giai đoạn nào**

Quy trình nhập hàng từ Trung Quốc qua UAE rồi phân phối sang 6 nước GCC trải qua nhiều giai đoạn phức tạp. Tuy nhiên, bên mua hàng thường quên nhập liệu hoặc cập nhật trạng thái, dẫn đến tình trạng: MKT không biết hàng đã về kho đích 1 hay chưa, không phân biệt được đơn nào đang chờ duyệt và đơn nào đang vận chuyển, hàng đến kho muộn mà không ai biết để điều chỉnh kế hoạch bán. Toàn bộ quản lý dựa trên file Excel rời rạc, phải hỏi từng người từng ngày, lãng phí 1–2 giờ/ngày chỉ để xác nhận tiến độ.

**Nỗi đau #2 — Tạo kịch bản chào hàng quá lâu và không đúng form**

Mỗi sản phẩm cần 4 đoạn kịch bản cho 4 khung giờ vàng (6h, 11h, 17h, 21h). MKT từng sử dụng ChatGPT để viết kịch bản, nhưng mỗi lần tạo lại ra format khác nhau, tone không thống nhất, phải chỉnh sửa lại 70–80% nội dung. Với mỗi page cần kịch bản riêng, toàn bộ hướng dẫn phải copy-paste lại từ đầu. Tổng thời gian: **2–3 giờ chỉ để soạn kịch bản cho 1 sản phẩm**, nhân lên hàng chục sản phẩm mỗi tuần là một gánh nặng rất lớn.

**Nỗi đau #3 — Không bắn được tin nhắn cho khách ngoài 24 giờ**

Facebook Messenger có chính sách giới hạn: chỉ cho phép doanh nghiệp gửi tin nhắn cho khách hàng trong vòng 24 giờ kể từ lần tương tác cuối. Điều này có nghĩa **70% khách tiềm năng** nằm ngoài cửa sổ 24h không thể tiếp cận được. Trước đây, đội Sale phải dành **2 giờ/ngày** để cài đặt bot bắn tin thủ công qua Pancake CRM, và bot thường bắn lại cho cả khách đã mua hàng → gây spam, mất uy tín page. Việc quên gửi vào đúng khung giờ vàng cũng làm giảm tỷ lệ đọc tin đáng kể.

---

## 2. GIẢI PHÁP — HỆ THỐNG TALPHA

TAlpha là một dashboard tích hợp 3 module chính, được xây dựng 100% bằng phương pháp **Vibe Coding** — con người mô tả ý tưởng, AI viết toàn bộ code. Hệ thống giải quyết trọn vẹn 3 nỗi đau trên trong một giao diện duy nhất.

### 2.1. Module 1 — Tạo kịch bản chào hàng (Script Generator)

**Vấn đề giải quyết:** Giảm 90% thời gian soạn kịch bản, đảm bảo format chuẩn, tone phù hợp từng khung giờ.

**Cách hoạt động:**
1. MKT upload ảnh sản phẩm lên dashboard (hỗ trợ kéo thả nhiều ảnh)
2. Hệ thống gọi **Gemini AI API** để phân tích hình ảnh và tự động sinh ra 4 đoạn kịch bản:
   - **Đoạn 1 (6:00 sáng):** Tone lạc quan, chào ngày mới, giới thiệu sản phẩm nhẹ nhàng
   - **Đoạn 2 (11:00 trưa):** Tone chuyên nghiệp, tập trung vào giá trị sản phẩm, thành phần
   - **Đoạn 3 (17:00 chiều):** Tone FOMO (Fear of Missing Out), giá ưu đãi có thời hạn
   - **Đoạn 4 (21:00 tối):** Tone intimate, khuyến mãi cuối ngày, tạo cảm giác gần gũi
3. MKT có thể chỉnh sửa, lưu template, và tái sử dụng cho các sản phẩm tương tự

**Giá trị mang lại:**
- Từ 2–3 giờ → **30 giây** để có kịch bản hoàn chỉnh
- Format chuẩn 100%, không cần chỉnh sửa lại
- Hỗ trợ biến động như `{tên_sản_phẩm}`, `{giá}` để cá nhân hoá nội dung
- Template có thể tái sử dụng, tiết kiệm thời gian lũy tiến

### 2.2. Module 2 — Đặt và Flow hàng (Shipment Tracker)

**Vấn đề giải quyết:** Quản lý toàn bộ quy trình nhập hàng từ TQ → UAE → GCC với 17 trạng thái, cảnh báo tự động, không phụ thuộc vào việc "ai đó nhớ nhập liệu".

**Cách hoạt động:**

Hệ thống quản lý đơn nhập hàng qua 3 sub-module:

**a) Tổng quan (Overview Dashboard):**
- Hiển thị số liệu real-time: tổng đơn, đơn chờ duyệt, đang vận chuyển, đã giao
- Cảnh báo đơn bị muộn so với ngày dự kiến
- Biểu đồ phân bổ theo quốc gia và trạng thái

**b) Đơn nhập hàng (Shipment Management):**
- Form tạo đơn đầy đủ: tên SP, link ảnh, quốc gia, đối tác vận chuyển, MKT phụ trách, mã tracking, SKU, NCC, link đặt hàng, ngày đặt/dự kiến, giá/sp, phí vận chuyển, thuộc tính, lý do nhập
- **17 trạng thái** theo approval flow: MKT yêu cầu → Kiểm tra/Duyệt → Đặt hàng NCC → Đang sản xuất → Đã ship → Thông quan → Nhập kho đích 1 → Phân phối → Giao hàng thành công
- Hỗ trợ nhận hàng nhiều lần (batch receiving) với tự động cập nhật trạng thái khi đủ số lượng
- Tự tính ngày muộn và hiển thị cảnh báo

**c) Phân phối GCC (Distribution):**
- Tạo đơn phân phối từ đơn gốc cho 6 quốc gia: KSA, Kuwait, Qatar, Bahrain, Oman, UAE
- Tracking riêng cho từng nước với đối tác vận chuyển khác nhau
- Quản lý tiến độ phân phối độc lập

**Giá trị mang lại:**
- Thay thế hoàn toàn Excel → **1 dashboard duy nhất**, ai cũng cập nhật real-time
- Không cần hỏi từng người → hệ thống tự cảnh báo đơn muộn, đơn chờ duyệt
- Approval flow rõ ràng → trách nhiệm minh bạch ở từng giai đoạn
- Từ 1–2h/ngày xác nhận tiến độ → **0 phút** (mở dashboard là thấy)

### 2.3. Module 3 — Gửi tin nhắn hàng loạt (Broadcast Engine)

**Vấn đề giải quyết:** Gửi tin nhắn tự động cho hàng ngàn khách hàng, vượt qua giới hạn 24h của Facebook, loại trừ khách đã mua, hẹn lịch chạy mỗi ngày không cần thao tác.

**Cách hoạt động:**

**a) Soạn tin 4 đoạn:**
- Soạn 4 nội dung tương ứng 4 khung giờ (lấy từ Module 1)
- Hỗ trợ đính kèm ảnh sản phẩm
- Preview trước khi gửi

**b) Chọn khách hàng thông minh:**
- Kết nối **Pancake CRM API** để lấy danh sách khách hàng (lên đến 100.000 khách)
- **Lọc thông minh:** tự động loại trừ khách có thẻ "Đã gửi" (đã mua hàng), loại khách có số điện thoại (đã chốt đơn), loại khách có đơn hàng trên CRM
- Lọc theo giới tính, thời gian tương tác, trạng thái CRM

**c) Hẹn lịch tự động (Auto Scheduler):**
- Cài đặt 1 lần, chạy mỗi ngày tự động
- Background worker kiểm tra mỗi 60 giây
- Tự động fire segment khi đến giờ: Đoạn 1→6h, Đoạn 2→11h, Đoạn 3→17h, Đoạn 4→21h
- Trạng thái real-time: ✓ **Xanh** (đã gửi) | ⏳ **Vàng** (chờ gửi) | ✗ **Đỏ** (lỗi)
- Sang ngày mới tự động reset, chạy lại chu kỳ

**d) Bypass giới hạn 24h — HUMAN_AGENT tag:**
- Sử dụng **Facebook Graph API v21** trực tiếp (không qua Pancake CRM)
- Áp dụng **MESSAGE_TAG: HUMAN_AGENT** để mở rộng cửa sổ gửi tin từ 24h lên **7 ngày**
- Fallback thông minh: thử gửi qua Pancake trước → nếu lỗi → tự chuyển sang Facebook Graph API
- Delay thông minh giữa mỗi tin (2–5 giây) để tránh rate limit

**Giá trị mang lại:**
- Sale không cần dành 2h/ngày cài bot → **hệ thống tự chạy 24/7**
- Reach từ 30% (chỉ trong 24h) → **100%** khách hàng (7 ngày)
- Không spam khách đã mua → giữ uy tín page, giảm report
- 4 khung giờ vàng tự động → tỷ lệ đọc tin tăng đáng kể

---

## 3. KIẾN TRÚC KỸ THUẬT

### 3.1. Tech Stack

| Layer | Công nghệ | Vai trò |
|-------|-----------|---------|
| Frontend | Next.js 14, React, TypeScript | App Router, SPA dashboard |
| UI/UX | Tailwind CSS, Framer Motion, Lucide Icons | Responsive, animation mượt |
| AI | Google Gemini API | Sinh kịch bản từ ảnh sản phẩm |
| CRM | Pancake CRM REST API | Quản lý khách hàng, đơn hàng |
| Messaging | Facebook Graph API v21 | Gửi tin nhắn broadcast |
| Data | localStorage (client-side) | Lưu shipment, cấu hình broadcast |
| Hosting | Vercel | Deploy tự động, edge network |

### 3.2. Data Flow

```
MKT Upload ảnh → Gemini AI → 4 đoạn kịch bản
                                    ↓
                        Soạn tin broadcast (4 đoạn)
                                    ↓
          Pancake CRM API → Lấy danh sách KH → Lọc thông minh
                                    ↓
               Auto Scheduler → Fire theo 4 khung giờ
                                    ↓
   Pancake API (trong 24h) ──fallback──→ Facebook Graph API (7 ngày)
                                    ↓
                        Messenger khách hàng
```

### 3.3. Kiến trúc Module

Hệ thống được thiết kế theo **kiến trúc module độc lập**: mỗi module là một React component riêng biệt, có state riêng, data storage riêng (sử dụng key localStorage khác nhau), không chia sẻ side-effect. Điều này đảm bảo việc thêm/sửa/xoá một module không ảnh hưởng đến các module khác.

---

## 4. PHƯƠNG PHÁP — 100% VIBE CODING

### 4.1. Vibe Coding là gì?

Vibe Coding là phương pháp phát triển phần mềm trong đó **con người đóng vai trò Product Owner & Solution Architect**, còn **AI đóng vai trò Developer**. Con người mô tả ý tưởng, yêu cầu, và nghiệp vụ bằng ngôn ngữ tự nhiên; AI viết toàn bộ code, debug, và deploy.

### 4.2. Quy trình áp dụng trong TAlpha

1. **Mô tả nghiệp vụ:** MKT mô tả pain point và quy trình hiện tại bằng tiếng Việt
2. **AI thiết kế giải pháp:** AI phân tích, đề xuất kiến trúc, chọn tech stack phù hợp
3. **AI code:** AI viết toàn bộ component, API route, logic nghiệp vụ
4. **Review & iterate:** MKT test trên giao diện thực, feedback → AI chỉnh sửa
5. **Deploy:** AI cấu hình và deploy lên Vercel tự động

### 4.3. Kết quả

- **0 dòng code** được viết bởi con người
- **100% code** do AI sinh ra (bao gồm cả file cấu hình, script deploy)
- Thời gian phát triển: **< 1 tuần** cho toàn bộ 3 module
- Không yêu cầu kiến thức lập trình từ người dùng

---

## 5. KẾT QUẢ & TÁC ĐỘNG

### 5.1. Chỉ số KPI

| Chỉ số | Trước TAlpha | Sau TAlpha | Cải thiện |
|--------|-------------|-----------|-----------|
| Thời gian soạn kịch bản | 2–3 giờ/SP | 30 giây/SP | **↓ 90%** |
| Tần suất chào hàng | 1 lần/ngày | 4 lần/ngày | **↑ 4x** |
| Thời gian cài broadcast | 2 giờ/ngày | 10 phút/ngày | **↓ 85%** |
| Reach khách hàng | 30% (trong 24h) | 100% (7 ngày) | **↑ 3.3x** |
| Quản lý shipment | Excel rời rạc | Dashboard real-time | **Thay thế hoàn toàn** |
| Cảnh báo đơn muộn | Không có | Tự động | **Mới** |
| Code viết thủ công | N/A | 0 dòng | **100% Vibe Coded** |

### 5.2. Tác động kinh doanh

- **Tiết kiệm nhân lực:** ≈ 4–5 giờ/ngày/nhân viên MKT → quy đổi ≈ **100+ giờ/tháng** cho toàn đội
- **Tăng doanh thu:** Reach 100% khách hàng thay vì 30% → cơ hội chốt đơn tăng tương ứng
- **Giảm rủi ro:** Không spam khách đã mua, approval flow rõ ràng, cảnh báo đơn muộn
- **Tính mở rộng:** Kiến trúc module cho phép thêm tính năng mới mà không ảnh hưởng tính năng cũ

### 5.3. Tính sáng tạo & Đổi mới

- **AI-first approach:** Không dùng AI như công cụ hỗ trợ, mà để AI **LÀM TOÀN BỘ** — từ thiết kế đến code đến deploy
- **Giải quyết vấn đề thực tế:** Không phải sản phẩm demo, mà là hệ thống **đang chạy production**, phục vụ đội ngũ hàng ngày
- **Bypass Facebook 24h:** Sáng tạo kỹ thuật sử dụng HUMAN_AGENT tag — giải pháp mà nhiều agency lớn chưa áp dụng
- **Non-technical team build tech product:** Đội MKT không có developer, nhưng vẫn xây dựng được sản phẩm công nghệ hoàn chỉnh nhờ Vibe Coding

---

## 6. ROADMAP PHÁT TRIỂN

| Giai đoạn | Thời gian | Nội dung |
|-----------|-----------|----------|
| **V1 — Hiện tại** | Q1/2026 | 3 module cốt lõi, live production |
| **V2 — Tối ưu** | Q2/2026 | Server-side scheduler, database migration, A/B testing kịch bản |
| **V3 — AI nâng cao** | Q3/2026 | Chatbot AI tự trả lời, phân tích phản hồi KH, đề xuất sản phẩm |
| **V4 — Mở rộng** | Q4/2026 | WhatsApp/Zalo integration, multi-brand, financial reconciliation |

---

*Tài liệu được biên soạn bởi đội Pi Alpha — Tiểu Alpha Middle East, tháng 3/2026.*
