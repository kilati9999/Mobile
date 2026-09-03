/**
 * Ghép nối ESP32 lần đầu qua SoftAP + captive portal.
 *
 * HỢP ĐỒNG API phía firmware ESP32 cần triển khai khi ở chế độ AP (chưa
 * có WiFi nhà, hoặc người dùng giữ nút BOOT để vào lại chế độ cấu hình):
 *
 *  - Phát WiFi tên "GestureHome-<6 ký tự cuối chip id>" (mở, không mật
 *    khẩu, hoặc mật khẩu cố định tuỳ bạn), IP mặc định của ESP32 SoftAP
 *    là 192.168.4.1 (giá trị mặc định của thư viện WiFi Arduino/ESP-IDF).
 *
 *  - GET  http://192.168.4.1/status
 *      -> 200 { "chip_id": "AA:BB:CC:DD:EE:FF", "configured": false }
 *
 *  - POST http://192.168.4.1/configure
 *      body JSON: { "ssid": "...", "password": "...", "server_url": "http://..." }
 *      -> 200 { "ok": true }
 *      Sau khi nhận, ESP32 lưu lại (NVS/Preferences), disconnect AP, kết
 *      nối vào "ssid"/"password", rồi gọi POST {server_url}/api/esp32/pair
 *      với chip_id của chính nó - TÁI SỬ DỤNG đúng luồng pair() đã có sẵn,
 *      không cần đổi gì bên Flask.
 */
const AP_BASE_URL = "http://192.168.4.1";
const AP_TIMEOUT_MS = 6000;

export class ProvisioningError extends Error {}

async function apRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AP_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AP_BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    throw new ProvisioningError(
      e?.name === "AbortError"
        ? "Không thấy board ESP32 phản hồi - kiểm tra điện thoại đã kết nối đúng WiFi của board chưa."
        : "Không kết nối được tới board - kiểm tra điện thoại đã kết nối WiFi của board (192.168.4.1) chưa."
    );
  }
  clearTimeout(timeout);
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) throw new ProvisioningError(payload?.error || `Board phản hồi lỗi (${res.status}).`);
  return payload as T;
}

export interface ApStatus {
  chip_id: string;
  configured: boolean;
}

export function getApStatus(): Promise<ApStatus> {
  return apRequest<ApStatus>("/status");
}

export function sendApConfig(ssid: string, password: string, serverUrl: string): Promise<{ ok: boolean }> {
  return apRequest<{ ok: boolean }>("/configure", {
    method: "POST",
    body: JSON.stringify({ ssid, password, server_url: serverUrl }),
  });
}
