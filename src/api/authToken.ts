/**
 * authToken.ts
 * ============
 * Lưu token đăng nhập (Bearer) vào bộ nhớ máy bằng AsyncStorage để dùng
 * lại nhiều lần, kể cả sau khi tắt/mở lại app. Dùng chung cho MỌI màn
 * hình gọi Face Auth API (/register, /verify, /users, /history...).
 *
 * Giữ nguyên khoá lưu "face_auth_token" như file gốc.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "face_auth_token";

export async function getToken(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(TOKEN_KEY)) || null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token.trim());
}

export async function clearToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // bỏ qua
  }
}

// Trả về header Authorization sẵn sàng gắn vào fetch(); {} nếu chưa có token.
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
