import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { Device, SensorsResponse, Site, StateResponse, User } from "./types";

const SERVER_URL_KEY = "gesture-home:server-url";

let cachedServerUrl: string | null = null;

function defaultServerUrl(): string {
  return (Constants.expoConfig?.extra?.defaultServerUrl as string) || "http://10.0.2.2:5050";
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
