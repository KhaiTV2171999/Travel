# Ứng dụng đăng ký du lịch

Web ưu tiên hiển thị trên điện thoại. Dữ liệu nằm trong Google Sheet, ảnh lấy từ Google Drive. Không cần server và không tốn phí.

- **Giao diện** (`index.html`, `styles.css`, `app.js`): file tĩnh, đặt trên GitHub Pages hoặc Netlify.
- **Backend** (`apps-script/Code.gs`): Google Apps Script gắn với Google Sheet, chỉ trả dữ liệu JSON.

| Tab | Chức năng |
|---|---|
| **Chuyến đi** | Ngày giờ, địa điểm, điểm tập trung · album ảnh · guide địa điểm · lịch trình theo ngày · tổng quan kinh phí |
| **Đăng ký** | Tên thành viên · có người nhà đi cùng không · số người lớn / trẻ em · ghi chú |
| **Danh sách** | Người đã đăng ký kèm loại phòng và người ở cùng · thống kê số người · tìm kiếm |
| **Bình luận** | Bình luận chung |

## Các file

```
index.html          khung HTML của trang
styles.css          CSS (giao diện, màu sắc)
app.js              JavaScript (hiển thị, gửi form, gọi API). Dòng đầu chứa API_URL
apps-script/
  Code.gs           backend: đọc/ghi Google Sheet, lấy ảnh Drive
  appsscript.json   cấu hình Apps Script (múi giờ VN, quyền truy cập)
```

## Cài đặt

### Bước 1: Backend trên Google Sheet
1. Tạo một **Google Sheet** mới, vào **Tiện ích mở rộng → Apps Script**.
2. Dán nội dung `apps-script/Code.gs` vào file `Code.gs` có sẵn.
3. Chọn hàm `setupSheets` trên thanh công cụ, bấm **Chạy** và cấp quyền. Sheet sẽ tự tạo 6 trang kèm dữ liệu mẫu.
4. Vào **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
5. Bấm **Triển khai** và copy URL (kết thúc bằng `/exec`). Mở URL này trên trình duyệt, nếu thấy dữ liệu JSON `{"ok":true,...}` là backend đã chạy.

### Bước 2: Giao diện
1. Mở `app.js`, dán URL ở bước 1.5 vào dòng đầu: `const API_URL = 'https://script.google.com/macros/s/.../exec';`
2. Đưa 3 file `index.html`, `styles.css`, `app.js` lên hosting tĩnh, ví dụ:
   - **GitHub Pages**: tạo repo, push 3 file, vào Settings → Pages → chọn branch `main`.
   - **Netlify**: kéo thả thư mục chứa 3 file vào https://app.netlify.com/drop
3. Gửi link trang web cho mọi người.

Muốn chạy thử trên máy thì mở terminal trong thư mục dự án, chạy `npx serve` hoặc `python -m http.server`, rồi mở địa chỉ được in ra.

### Khi cập nhật
- **Sửa giao diện** (`index.html` / `styles.css` / `app.js`): chỉ cần upload lại file đã sửa. Không phải đụng tới Apps Script.
  Nếu điện thoại vẫn hiện bản cũ do trình duyệt còn cache, đổi số phiên bản trong `index.html`, ví dụ `styles.css?v=2`, `app.js?v=2`.
- **Sửa `Code.gs`**: vào **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Phiên bản mới**. URL `/exec` giữ nguyên nên không phải sửa `app.js`.
- **Sửa dữ liệu trong Sheet**: không cần deploy lại. Backend lưu tạm dữ liệu 60 giây cho nhanh, nên sau tối đa 1 phút app sẽ thấy dữ liệu mới. Muốn thấy ngay thì chạy hàm `clearCache` trong trình soạn thảo Apps Script.

## Cấu trúc Google Sheet

Tên sheet và tên cột không phân biệt hoa/thường hay có dấu/không dấu, và có thể đổi thứ tự cột.

### `Thông tin` (2 cột: Mục | Giá trị)
| Mục | Ví dụ |
|---|---|
| Tên chuyến đi | Du lịch Đà Lạt 3N2Đ |
| Địa điểm | Đà Lạt, Lâm Đồng |
| Ngày đi / Ngày về | 16/10/2026 |
| Giờ tập trung | 05:30 |
| Điểm tập trung | Sảnh công ty |
| Hạn đăng ký | 10/10/2026. Sau ngày này form đăng ký sẽ tự khoá (ô phải có định dạng ngày) |
| Liên hệ | Anh Minh - 0901 234 567. Số điện thoại tự thành link bấm gọi |
| Ảnh bìa | Link ảnh trên Google Drive |
| Thư mục ảnh | Link thư mục Drive. Toàn bộ ảnh trong thư mục sẽ hiện thành album |
| Giới thiệu | Đoạn mô tả chuyến đi |
| Phí người lớn | 2500000. Số tiền mỗi người lớn phải nộp (trẻ em không tính tiền) |
| Ngân hàng | MB, VCB, TCB, ACB, BIDV... Dùng để tạo mã QR chuyển khoản |
| Số tài khoản / Chủ tài khoản | Tài khoản nhận tiền |

### `Guide`: Tiêu đề | Nội dung | Ảnh
### `Ăn uống`: Tên | Mô tả | Địa chỉ | Ảnh
Địa chỉ hiện thành link mở Google Maps. Sheet cũ chưa có trang này thì chạy lại hàm `setupSheets`: hàm chỉ tạo trang còn thiếu, không đụng dữ liệu đang có.
### `Khách sạn`: Tên | Mô tả | Địa chỉ | Điện thoại | Ảnh
Địa chỉ mở Google Maps, điện thoại bấm để gọi.
### `Lịch trình`: Ngày | Giờ | Hoạt động | Địa điểm | Ghi chú | Ảnh
Chỉ cần ghi cột **Ngày** ở dòng đầu tiên của mỗi ngày. Các dòng sau để trống sẽ được tính chung vào ngày đó.
### `Kinh phí`: Hạng mục | Số tiền | Ghi chú
### `Đăng ký`: Thời gian | Tên | Có người nhà | Số người lớn | Số trẻ em | Ghi chú | **Xếp phòng** | **Đã nộp**
Các cột đầu do app tự ghi. Người tổ chức tự điền:
- **Xếp phòng**: cùng giá trị = ở chung phòng (vd `1`, `2`...). Tab Danh sách sẽ gom theo phòng.
- **Đã nộp**: số tiền đã nhận của người đó (vd `2000000`). Tab Chuyến đi → Nộp tiền sẽ hiện ai đã nộp / còn thiếu.
  Số tiền phải nộp = (1 + số người lớn đi cùng) × Phí người lớn; trẻ em không tính.
- "Số người lớn" là số người lớn đi cùng, **không tính** người đăng ký.
- Muốn xoá hoặc sửa một đăng ký thì sửa trực tiếp trên Sheet.
### `Bình luận`: Thời gian | Tên | Nội dung

## Ảnh từ Google Drive

1. Upload ảnh lên Drive.
2. Chuột phải → **Chia sẻ** → Quyền truy cập chung: **Bất kỳ ai có đường liên kết** (Người xem).
   Có thể chia sẻ cả thư mục một lần thì mọi ảnh bên trong đều xem được.
3. **Sao chép đường liên kết** rồi dán vào ô "Ảnh" trong Sheet. App tự đổi link thành ảnh hiển thị được.

Album (`Thư mục ảnh`) được cache 10 phút, nên ảnh mới thêm vào thư mục có thể cần vài phút mới hiện.
