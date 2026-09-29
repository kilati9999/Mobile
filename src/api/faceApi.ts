/**
 * faceApi.ts
 * ==========
 * Toàn bộ lời gọi tới Face Auth API (main.py, chạy trên Pi, cổng riêng
 * KHÁC với server thiết bị chính - xem getFaceApiUrl() trong client.ts).
 * Khớp đúng theo main.py thật đã đọc:
 *
 *   POST /login              form: username, password  -> token
 *   POST /register           form: name + files: images[] (>= 5)  [cần Bearer + X-API-Key nếu có]
 *   POST /verify             files: images[] (>= 3, để kiểm tra chống giả mạo) [cần Bearer + X-API-Key nếu có]
 *   GET  /users/check-name   query: name                [cần Bearer]
 *   GET  /users                                          [cần Bearer + X-API-Key nếu có]
 *   GET  /history             query: limit                [cần Bearer + X-API-Key nếu có]
 *
 * Đăng nhập dùng ĐÚNG tài khoản/mật khẩu của hệ thống chính (main.py tự
 * gọi sang server Flask để xác thực) - không cần dán token thủ công.
 */
import { authHeaders, clearToken, saveToken } from "./authToken";
import { getFaceApiKey, getFaceApiUrl } from "./client";

export class FaceApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface FaceLoginResult {
  success: boolean;
  token: string;
  role: string;
  site_id: string;
  display_name: string;
  message: string;
}

export interface FaceRegisterResult {
  success: boolean;
  user_id: number | null;
  name: string | null;
  num_embeddings: number;
  message: string;
}

export interface FaceVerifyResult {
  success: boolean;
  name: string | null;
  confidence: number;
  message: string;
}

export interface FaceCheckNameResult {
  available: boolean;
  message: string;
}

async function baseHeaders(needAuth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = await getFaceApiKey();
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (needAuth) Object.assign(headers, await authHeaders());
  return headers;
}

async function handle401AndThrow(res: Response, data: any): Promise<never> {
  if (res.status === 401) {
    // Token sai/hết hạn - xoá luôn để màn gọi API biết quay lại yêu cầu đăng nhập
    await clearToken();
  }
  throw new FaceApiError(res.status, data?.detail || data?.message || `Lỗi máy chủ (${res.status})`);
}

/** Đăng nhập bằng ĐÚNG tài khoản/mật khẩu của hệ thống - main.py tự xác
 * thực qua server Flask chính, không cần dán token thủ công. */
export async function faceLogin(username: string, password: string): Promise<FaceLoginResult> {
  const base = await getFaceApiUrl();
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  let res: Response;
  try {
    res = await fetch(`${base}/login`, {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    });
  } catch {
    throw new FaceApiError(0, "Không kết nối được tới Face API - kiểm tra lại địa chỉ trong Cài đặt.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new FaceApiError(res.status, data.detail || data.message || "Đăng nhập thất bại.");
  }
  await saveToken(data.token);
  return data as FaceLoginResult;
}

/** Kiểm tra tên đã dùng chưa - gọi ngay sau khi người dùng nhập tên, để
 * báo trùng SỚM thay vì để tới lúc chụp/quay xong mới biết bị từ chối. */
export async function faceCheckName(name: string): Promise<FaceCheckNameResult> {
  const base = await getFaceApiUrl();
  const res = await fetch(`${base}/users/check-name?name=${encodeURIComponent(name)}`, {
    headers: await baseHeaders(true),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return handle401AndThrow(res, data);
  return data as FaceCheckNameResult;
}

export async function faceRegister(name: string, imageUris: string[]): Promise<FaceRegisterResult> {
  const base = await getFaceApiUrl();
  const form = new FormData();
  form.append("name", name);
  imageUris.forEach((uri, idx) => {
    // @ts-expect-error - React Native FormData chấp nhận object {uri,name,type}, khác với DOM FormData chuẩn
    form.append("images", { uri, name: `face_${idx}.jpg`, type: "image/jpeg" });
  });

  const headers = await baseHeaders(true);
  const res = await fetch(`${base}/register`, { method: "POST", body: form, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return handle401AndThrow(res, data);
  return data as FaceRegisterResult;
}

/** Gửi 1 CHÙM ảnh liên tiếp (>= 3) để xác thực - main.py dùng nhiều ảnh
 * để kiểm tra chống giả mạo (ảnh/video tĩnh), không chỉ so khớp 1 ảnh. */
export async function faceVerify(imageUris: string[]): Promise<FaceVerifyResult> {
  const base = await getFaceApiUrl();
  const form = new FormData();
  imageUris.forEach((uri, idx) => {
    // @ts-expect-error - React Native FormData chấp nhận object {uri,name,type}, khác với DOM FormData chuẩn
    form.append("images", { uri, name: `verify_${idx}.jpg`, type: "image/jpeg" });
  });

  const headers = await baseHeaders(true);
  const res = await fetch(`${base}/verify`, { method: "POST", body: form, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return handle401AndThrow(res, data);
  return data as FaceVerifyResult;
}
