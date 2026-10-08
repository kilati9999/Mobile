import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { Account, Device, PendingBoard, SensorsResponse, Site, StateResponse, User } from "./types";

const SERVER_URL_KEY = "gesture-home:server-url";

let cachedServerUrl: string | null = null;

function defaultServerUrl(): string {
  return (Constants.expoConfig?.extra?.defaultServerUrl as string) || "http://10.0.2.2:5000";
}

export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedServerUrl = stored || defaultServerUrl();
  return cachedServerUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, "");
  cachedServerUrl = trimmed;
  await AsyncStorage.setItem(SERVER_URL_KEY, trimmed);
}

export async function clearServerUrl(): Promise<void> {
  cachedServerUrl = null;
  await AsyncStorage.removeItem(SERVER_URL_KEY);
}

// ---------------------------------------------------------------------
// Địa chỉ Face Auth API (main.py, server RIÊNG BIỆT với server thiết bị
// ở trên - có thể chạy trên Pi khác, cổng khác). Lưu vào máy giống hệt
// cách lưu địa chỉ server chính, để đổi cổng/IP không cần sửa code.
const FACE_API_URL_KEY = "gesture-home:face-api-url";
let cachedFaceApiUrl: string | null = null;

export async function getFaceApiUrl(): Promise<string> {
  if (cachedFaceApiUrl) return cachedFaceApiUrl;
  const stored = await AsyncStorage.getItem(FACE_API_URL_KEY);
  cachedFaceApiUrl = stored || "http://192.168.1.92:8000";
  return cachedFaceApiUrl;
}

export async function setFaceApiUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, "");
  cachedFaceApiUrl = trimmed;
  await AsyncStorage.setItem(FACE_API_URL_KEY, trimmed);
}

// API_KEY tuỳ chọn của main.py (biến môi trường API_KEY trên Pi) - nếu
// Pi có đặt, mọi request /register /verify /users /history phải kèm
// header X-API-Key đúng giá trị đó. Để trống nếu Pi không đặt API_KEY.
const FACE_API_KEY_KEY = "gesture-home:face-api-key";
let cachedFaceApiKey: string | null = null;

export async function getFaceApiKey(): Promise<string> {
  if (cachedFaceApiKey !== null) return cachedFaceApiKey;
  const stored = await AsyncStorage.getItem(FACE_API_KEY_KEY);
  cachedFaceApiKey = stored || "";
  return cachedFaceApiKey;
}

export async function setFaceApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  cachedFaceApiKey = trimmed;
  await AsyncStorage.setItem(FACE_API_KEY_KEY, trimmed);
}

/** Kiểm tra Face API có phản hồi được không - KHÔNG biết trước main.py có
 * route gì ngoài /register, nên coi BẤT KỲ phản hồi HTTP nào (kể cả 404)
 * là "máy chủ có tồn tại và mạng thông" - chỉ lỗi mạng/timeout mới coi là
 * thất bại thật sự. */
export async function testFaceApiReachable(url: string): Promise<{ ok: boolean; message: string }> {
  const base = url.trim().replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(base, { signal: controller.signal });
    return { ok: true, message: "Kết nối được tới địa chỉ này." };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, message: "Hết thời gian chờ - kiểm tra lại IP/cổng và mạng." };
    }
    return { ok: false, message: "Không kết nối được - kiểm tra lại IP/cổng, main.py đã chạy chưa, và cùng mạng chưa." };
  } finally {
    clearTimeout(timeout);
  }
}

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, payload: any) {
    super(payload?.error || `Lỗi máy chủ (${status})`);
    this.status = status;
    this.payload = payload;
  }
}

// Tailscale (đặc biệt lúc chưa thiết lập được đường P2P trực tiếp, phải đi
// qua DERP relay) có độ trễ cao hơn LAN thường - dùng timeout rộng rãi hơn
// để không báo lỗi timeout oan khi mạng chỉ đang hơi chậm.
const REQUEST_TIMEOUT_MS = 20000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = await getServerUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") {
      throw new ApiError(0, { error: "Hết thời gian chờ kết nối tới máy chủ." });
    }
    throw new ApiError(0, { error: "Không kết nối được máy chủ - kiểm tra địa chỉ IP và mạng." });
  }
  clearTimeout(timeout);

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // no body / not JSON
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

// ---------------------------------------------------------------- auth ----

export async function apiLogin(username: string, password: string): Promise<User> {
  const res = await request<{ ok: boolean; user: User }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return res.user;
}

export async function apiLogout(): Promise<void> {
  await request("/api/logout", { method: "POST" });
}

export async function apiMe(): Promise<User | null> {
  try {
    const res = await request<{ ok: boolean; user: User }>("/api/me");
    return res.user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

// -------------------------------------------------------------- polling ---

export function getState(): Promise<StateResponse> {
  return request<StateResponse>("/api/state");
}

export function getDevices(siteId?: string | null): Promise<Device[]> {
  const qs = siteId ? `?site=${encodeURIComponent(siteId)}` : "";
  return request<Device[]>(`/api/devices${qs}`);
}

export function getSites(): Promise<Site[]> {
  return request<Site[]>("/api/sites");
}

export function getSensors(): Promise<SensorsResponse> {
  return request<SensorsResponse>("/api/sensors");
}

export function getHistory(): Promise<any[]> {
  return request<any[]>("/api/history");
}

// -------------------------------------------------------------- actions ---

export async function toggleDevice(deviceId: string): Promise<Device> {
  return request<Device>(`/api/devices/${encodeURIComponent(deviceId)}/toggle`, { method: "POST" });
}

export async function setDeviceLevel(deviceId: string, level: number): Promise<Device> {
  return request<Device>(`/api/devices/${encodeURIComponent(deviceId)}/level`, {
    method: "POST",
    body: JSON.stringify({ level }),
  });
}

// ---------------------------------------------------------------------
// Board ESP32 đang "chờ gán" - board đã pair() nhưng chưa khớp mac với
// thiết bị nào (xem app/esp32.py bên Flask).

export function getPendingBoards(): Promise<PendingBoard[]> {
  return request<PendingBoard[]>("/api/esp32/pending");
}

export function assignPendingBoard(key: string, deviceId: string): Promise<{ devices: Device[]; pending: PendingBoard[] }> {
  return request(`/api/esp32/pending/${encodeURIComponent(key)}/assign`, {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId }),
  });
}

export function discardPendingBoard(key: string): Promise<{ pending: PendingBoard[] }> {
  return request(`/api/esp32/pending/${encodeURIComponent(key)}/discard`, { method: "POST" });
}

export interface CreateDeviceInput {
  name: string;
  type: string;
  site_id: string;
  mac?: string | null;
  assigned_user?: string | null;
  conn_type?: "http" | "mqtt";
  mqtt_slot?: string | null;
}

export function createDevice(input: CreateDeviceInput): Promise<{ device_id: string; devices: Device[] }> {
  return request("/api/devices", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateDeviceInput {
  name?: string;
  type?: string;
  site_id?: string;
  mac?: string | null;
  assigned_user?: string | null;
}

export function updateDevice(deviceId: string, input: UpdateDeviceInput): Promise<{ devices: Device[] }> {
  return request(`/api/devices/${encodeURIComponent(deviceId)}`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteDeviceApi(deviceId: string): Promise<{ devices: Device[] }> {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/delete`, { method: "POST" });
}

export function disconnectDevice(deviceId: string): Promise<{ devices: Device[] }> {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/disconnect`, { method: "POST" });
}

export function getAccounts(): Promise<Account[]> {
  return request<Account[]>("/api/accounts");
}
