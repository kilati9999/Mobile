import { useCallback, useEffect, useState } from "react";
import { clearToken, getToken } from "../api/authToken";
import { faceLogin } from "../api/faceApi";

/** Quản lý trạng thái đăng nhập Face API cho 1 màn hình - undefined =
 * đang đọc token đã lưu, null = chưa đăng nhập, string = đã có token.
 * Đăng nhập bằng ĐÚNG tài khoản/mật khẩu hệ thống chính, không dán token
 * thủ công (main.py tự xác thực qua server Flask). */
export function useFaceAuth() {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await faceLogin(username, password);
    setToken(result.token);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
  }, []);

  return { token, login, logout };
}
