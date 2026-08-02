# GS334 iPhone Native (SideStore / Sideloadly)

## Kiến trúc
- Giao diện và dữ liệu: tải trực tiếp từ `https://appgs334.giatsay334-7d8.workers.dev`.
- Đồng bộ đơn hàng: Cloudflare Worker + D1 như bản PWA hiện tại.
- In tại tiệm: app iPhone gửi Raster ESC/POS trực tiếp qua TCP đến máy in LAN, mặc định `192.168.1.150:9100`.
- Không cần Print Hub hoặc PC khi người dùng đang ở cùng Wi-Fi với máy in và chủ động bấm In.

## Tạo IPA bằng GitHub
1. Tạo repository GitHub mới và upload toàn bộ thư mục này.
2. Đảm bảo nhánh chính tên `main`.
3. Vào **Actions → Build GS334 iOS IPA → Run workflow**.
4. Khi chạy xong, tải artifact `GS334-iOS-unsigned`.
5. Giải nén artifact để lấy `GS334-iOS-unsigned.ipa`.
6. Ký/cài IPA bằng Sideloadly hoặc SideStore.

## Lần đầu mở app
1. Đăng nhập GS334 như bình thường.
2. Vào **Máy in & cài đặt**.
3. Chọn máy in mạng, nhập IP `192.168.1.150`, port `9100`.
4. Bấm kiểm tra kết nối. iOS sẽ hỏi quyền **Mạng cục bộ**; chọn Cho phép.
5. Bấm In thử.

## Giới hạn
- In trực tiếp chỉ hoạt động khi iPhone có đường mạng tới máy in LAN (thường là cùng Wi-Fi tại tiệm).
- Khi ở ngoài tiệm, app vẫn xem/tạo/sửa đơn và nhận thông báo cloud, nhưng không thể truy cập IP nội bộ của máy in.
- SideStore/Sideloadly chịu trách nhiệm ký và gia hạn app; không làm thay đổi chính sách chạy nền của iOS.
