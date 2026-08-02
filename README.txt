GS334 Cloud v6.3.1

- In phiếu trực tiếp từ thẻ đơn giặt trên mobile.
- Bỏ nút In phiếu khỏi cửa sổ chi tiết.
- Phản hồi chạm nhanh hơn (75 ms) nhưng vẫn nhìn thấy.
- Giữ nguyên D1, Push, Raster Print và phân quyền của v6.2.9.

GS334 CLOUD v6.2.4 - COMPACT RASTER RECEIPT

- Thu gon khoang cach dong tren bill 80mm/58mm.
- Giam khoang trang giua header, thong tin don, dich vu, tong cong va footer.
- Preview va bill that van dung chung Raster renderer.
- Giu nguyen Remote Web Push, in 1/2/3 lien va auto-cut.

GS334 CLOUD v6.2.3 - REMOTE WEB PUSH FIX

GS334 CLOUD v6.2.0 — RASTER BILL + THÔNG BÁO APP

CẬP NHẬT CHÍNH
- Bill Raster mới: chữ lớn hơn, bố cục thoáng, tiền căn theo pixel.
- Chia ảnh in thành từng dải 96 dòng để tránh vạch đen/gạch ngang do bộ nhớ đệm Xprinter.
- Giữ in 1/2/3 liên và tự cắt giữa các liên.
- Thêm Web Push: chủ tiệm nhận biểu ngữ khi có đơn mới hoặc đơn chuyển sang Chờ khách lấy/Hoàn thành.
- iPhone: cần iOS 16.4+, cài GS334 vào Màn hình chính, rồi bật thông báo trong Máy in & cài đặt.
- Android: cài PWA và bật thông báo trong Máy in & cài đặt.

TRIỂN KHAI
1. npm install
2. npm test
3. npx wrangler deploy
4. Đóng Gateway cũ và mở CHAY-PRINT-GATEWAY.bat của bản này.
5. Đóng hẳn PWA rồi mở lại. Nếu iPhone giữ cache cũ, xóa icon và cài lại từ Safari.

BẬT THÔNG BÁO
- Đăng nhập tài khoản Chủ tiệm.
- Vào Máy in & cài đặt → Thông báo ứng dụng.
- Bấm Bật thông báo đơn mới và chọn Cho phép.

LƯU Ý
- Push Notification không phụ thuộc Print Gateway hoặc PC.
- In bill vẫn cần Print Gateway theo kiến trúc hiện tại.
