# Gesture Home (React Native / Expo)

App Android điều khiển thiết bị bằng cử chỉ tay - giao diện tham khảo các
app điều khiển thiết bị thông minh nổi tiếng (Google Home, Apple Home,
SmartThings): trang chủ nhóm thiết bị theo **phòng/vị trí** với thẻ bật/tắt
nhanh, màn hình chi tiết thiết bị có thanh trượt độ sáng/tốc độ, và tab
**Trực tiếp** hiển thị buffer/độ tin cậy nhận dạng cử chỉ theo thời gian
thực - giống hệt dữ liệu trên web, vì app này **dùng chung server Flask**
(Gesture Control Web UI) đã xây trước đó, không phải hệ thống tách biệt.

## Kiến trúc

- App KHÔNG tự nhận dạng cử chỉ trên điện thoại - nó là một client hiển
  thị/điều khiển, poll các API JSON của server Flask (giống cách web đang
  làm), y hệt cơ chế `/api/state`, `/api/devices`, `/api/sensors`...
- Đăng nhập dùng chung tài khoản với web (`app/auth.py` /
  `app/data/users.json`) qua 2 API mới: `POST /api/login`, `POST
  /api/logout`, `GET /api/me` (đã thêm vào `routes.py`, vẫn dùng session
  cookie Flask - React Native tự lưu cookie giữa các lần gọi fetch).
- Phân quyền y hệt web: tài khoản `khach_*` chỉ xem được (không có tab
  Thiết bị, không bật/tắt được), chỉ `admin` mới điều khiển được.

## Cài đặt

Cần Node.js 18+ và điện thoại Android (dùng app **Expo Go** tải từ Google
Play) hoặc máy ảo Android.

```bash
cd mobile
npm install
```

## Chạy thử (development, không cần build APK)

1. Chạy server Flask trước, **lắng nghe trên toàn mạng LAN** (đã cập nhật
   sẵn `run.py` dùng `host="0.0.0.0"`):
   ```bash
   cd ../gc
   python run.py
   ```
2. Tìm địa chỉ IP LAN của máy tính đang chạy server (Windows: `ipconfig`,
   macOS/Linux: `ifconfig` hoặc `ip a`) - ví dụ `192.168.1.10`.
3. Chạy app:
   ```bash
   cd mobile
   npx expo start
   ```
4. Quét mã QR bằng app **Expo Go** trên điện thoại (điện thoại phải cùng
   mạng Wi-Fi với máy tính).
5. Lần đầu mở app, nhập địa chỉ máy chủ dạng
   `http://192.168.1.10:5050` (đúng IP + cổng ở bước 2). Nếu dùng máy ảo
   Android trên cùng máy tính chạy server, dùng `http://10.0.2.2:5050`
   thay vì `127.0.0.1`.
6. Đăng nhập bằng tài khoản có sẵn trên web (`admin` / `admin123`,
   `khach_q1` / `q1123`, ...).

Có thể đổi lại địa chỉ máy chủ bất cứ lúc nào trong tab **Khác → Cài
đặt**.

## Build file APK thật (không qua Expo Go)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

(Cần tài khoản Expo (miễn phí) - `eas build` build trên cloud của Expo và
trả về link tải file `.apk`.)

## Kết nối từ xa qua Tailscale (không cùng WiFi)

Mặc định app chỉ kết nối được khi điện thoại và máy chạy server **cùng
một mạng WiFi/LAN**. Muốn điều khiển thiết bị từ xa (khác WiFi, dùng 4G/5G),
dùng [Tailscale](https://tailscale.com) - một mạng VPN riêng (mesh VPN dựa
trên WireGuard) giúp các thiết bị "nhìn thấy nhau" qua một địa chỉ IP cố
định (dạng `100.x.y.z`) dù đang ở đâu, không cần mở port trên router.

1. Cài Tailscale trên **máy tính đang chạy server Flask**
   (tailscale.com/download), đăng nhập bằng tài khoản Tailscale (Google/GitHub...).
2. Cài app **Tailscale** trên điện thoại Android (từ Google Play), đăng
   nhập **CÙNG tài khoản** (cùng tailnet) như bước 1.
3. Trên máy tính, chạy `tailscale ip -4` để lấy địa chỉ Tailscale (dạng
   `100.x.y.z`), hoặc mở [Tailscale Admin Console](https://login.tailscale.com/admin/machines)
   xem cột "IP address" / "Machine name" (tên máy dùng được luôn qua
   MagicDNS dạng `may-tinh.tailxxxx.ts.net`, không cần nhớ số IP).
4. Chạy server Flask như bình thường (`python run.py`, đã bind
   `0.0.0.0` nên tự động lắng nghe luôn trên địa chỉ Tailscale).
5. Trong app, vào **Cài đặt** (hoặc màn hình nhập địa chỉ lần đầu), nhập
   `http://100.x.y.z:5050` (thay bằng IP Tailscale thật) hoặc
   `http://may-tinh.tailxxxx.ts.net:5050`, bấm **Kiểm tra kết nối**.
6. Xong - giờ điện thoại dùng 4G/5G hay WiFi bất kỳ vẫn kết nối được, vì
   Tailscale tự tạo đường hầm riêng giữa 2 thiết bị.

Lưu ý: Tailscale tự mã hoá toàn bộ lưu lượng (WireGuard) nên dùng `http://`
(không phải `https://`) qua Tailscale vẫn an toàn - đây là lý do
`app.json` đã bật `usesCleartextTraffic: true` cho bản build APK thật
(Android mặc định chặn `http://` thường với app build production, Expo Go
thì không bị chặn nên lúc dev thử bằng Expo Go không cần để ý mục này).

## Cấu trúc thư mục

```
App.tsx                      # điểm khởi động: providers + navigation
src/
  api/client.ts               # gọi API JSON server Flask (login, devices, sensors...)
  api/types.ts                # kiểu dữ liệu khớp response backend
  context/AuthContext.tsx      # trạng thái đăng nhập toàn app
  hooks/usePolling.ts           # poll định kỳ (giống setInterval bên web)
  navigation/                    # Root stack + Bottom tabs
  components/                     # DeviceCard, RoomSection, KpiCard, MiniChart...
  screens/                         # Home, Live, Devices, Sensors, History, Settings...
  theme/index.ts                    # design tokens (màu, spacing, typography)
```

## Ghi chú

## Ghép nối ESP32 lần đầu qua SoftAP (Board mới → tab Thiết bị)

Ngoài luồng ghép nối cũ (board đã có sẵn WiFi, bấm Boot để `pair()` thẳng
tới server), app giờ có thêm màn hình **"Thêm board ESP32"** (nút "+ Board
mới" trên tab Thiết bị) dành cho board **hoàn toàn mới, chưa từng cấu hình
WiFi** - dùng đúng kiểu SoftAP + captive portal như các app Tuya/Kasa/Google
Home. Firmware ESP32 cần triển khai đúng hợp đồng sau khi đang ở chế độ AP
(chưa có WiFi nhà, hoặc giữ nút BOOT vài giây để quay lại chế độ này):

- Phát WiFi tên `GestureHome-<6 ký tự cuối chip id>`, IP mặc định
  `192.168.4.1` (mặc định của SoftAP trên ESP32).
- `GET /status` → `{"chip_id": "AA:BB:CC:DD:EE:FF", "configured": false}`
- `POST /configure` body JSON `{"ssid", "password", "server_url"}` →
  `{"ok": true}`, sau đó ESP32 lưu lại (NVS/Preferences), ngắt AP, kết nối
  WiFi nhà, rồi tự gọi `POST {server_url}/api/esp32/pair` với chip_id của
  chính nó - **tái dùng đúng API pair() đã có sẵn**, không cần sửa gì bên
  Flask. Sau khi pair xong, board sẽ xuất hiện ở mục "Board đang chờ gán"
  trên tab Thiết bị như luồng cũ.

Trên ESP32 (Arduino), gợi ý dùng `WiFi.softAP(ssid)` + thư viện
`ESPAsyncWebServer` (hoặc `WebServer` chuẩn) để dựng 2 endpoint trên, và
`Preferences.h` để lưu SSID/mật khẩu/server_url qua các lần khởi động lại.



- Level (độ sáng/tốc độ) điều khiển qua API mới `POST
  /api/devices/<id>/level` (đã thêm vào backend cùng đợt này) - trước đó
  web chỉ có bật/tắt qua giao diện, gesture mapping vẫn là cách tăng/giảm
  mức chính trên web.
- App không cần thư viện camera/MediaPipe vì việc "nhận dạng cử chỉ" vẫn
  do server mô phỏng/xử lý - đúng kiến trúc hiện tại của dự án (xem
  `app/simulator.py`, phần ghi chú nối pipeline thật trong README gốc).
