import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiMe, setServerUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme";

export default function ServerSetupScreen() {
  const { refreshServerConfigured } = useAuth();
  const [url, setUrl] = useState("http://192.168.1.10:5000");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onContinue() {
    setErrorMsg(null);
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setErrorMsg("Địa chỉ phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setSaving(true);
    await setServerUrl(url);
    try {
      // /api/me trả 401 khi chưa đăng nhập - vẫn là dấu hiệu server phản hồi
      // được, nghĩa là địa chỉ đúng, nên coi là thành công.
      await apiMe();
      setSaving(false);
      await refreshServerConfigured();
    } catch (e) {
      setSaving(false);
      if (e instanceof ApiError && e.status === 401) {
        await refreshServerConfigured();
        return;
      }
      const msg = e instanceof ApiError ? e.message : "Không kết nối được máy chủ.";
      setErrorMsg(msg);
    }
  }

  async function onContinueAnyway() {
    await refreshServerConfigured();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="hardware-chip" size={30} color={colors.accent} />
          </View>
          <Text style={styles.eyebrow}>Kết nối máy chủ</Text>
          <Text style={styles.title}>Nhập địa chỉ server{"\n"}Gesture Control</Text>
          <Text style={styles.desc}>
            Đây là địa chỉ IP LAN + cổng của máy tính đang chạy server Flask (Gesture Control Web UI). Ví dụ:{" "}
            <Text style={styles.mono}>http://192.168.1.10:5000</Text>. Nếu dùng máy ảo Android trên cùng máy tính, dùng{" "}
            <Text style={styles.mono}>http://10.0.2.2:5000</Text>.
          </Text>
          <Text style={styles.desc}>
            Muốn dùng ở xa (không cùng WiFi)? Cài{" "}
            <Text style={styles.mono}>Tailscale</Text> trên cả máy chạy server lẫn điện thoại, đăng nhập chung 1
            tailnet, rồi nhập địa chỉ Tailscale của máy chủ, ví dụ{" "}
            <Text style={styles.mono}>http://100.101.102.103:5000</Text> hoặc tên MagicDNS như{" "}
            <Text style={styles.mono}>http://may-tinh.tailxxxx.ts.net:5000</Text>.
          </Text>

          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.10:5000"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{errorMsg}</Text>
              <TouchableOpacity onPress={onContinueAnyway} style={styles.anywayLink}>
                <Text style={styles.anywayText}>Vẫn tiếp tục với địa chỉ này</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={styles.button} onPress={onContinue} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{saving ? "Đang lưu…" : "Tiếp tục"}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Điện thoại và máy tính chạy server phải ở CÙNG mạng Wi-Fi. Bạn có thể đổi địa chỉ này sau trong mục Cài đặt.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xxl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  desc: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginBottom: spacing.xl },
  mono: { fontFamily: "monospace", color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  errorBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: "rgba(248,113,113,0.35)", borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  error: { color: colors.bad, fontSize: 12.5 },
  anywayLink: { marginTop: spacing.sm },
  anywayText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: "#04141c", fontWeight: "800", fontSize: 15 },
  hint: { color: colors.textFaint, fontSize: 11.5, marginTop: spacing.lg, lineHeight: 17 },
});
