import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearToken, getToken } from "../api/authToken";
import { ApiError, apiMe, getFaceApiUrl, getServerUrl, setFaceApiUrl, setServerUrl, testFaceApiReachable } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";

export default function SettingsScreen() {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [faceUrl, setFaceUrl] = useState("");
  const [faceSaving, setFaceSaving] = useState(false);
  const [faceTesting, setFaceTesting] = useState(false);
  const [faceMessage, setFaceMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    getServerUrl().then(setUrl);
    getFaceApiUrl().then(setFaceUrl);
    getToken().then((t) => setHasToken(!!t));
  }, []);

  async function onClearToken() {
    await clearToken();
    setHasToken(false);
  }

  async function onSave() {
    setMessage(null);
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setMessage({ text: "Địa chỉ phải bắt đầu bằng http:// hoặc https://", ok: false });
      return;
    }
    setSaving(true);
    await setServerUrl(url);
    setSaving(false);
    setMessage({ text: "Đã lưu địa chỉ máy chủ.", ok: true });
  }

  async function onTest() {
    setTesting(true);
    setMessage(null);
    try {
      await setServerUrl(url);
      const me = await apiMe();
      setMessage({
        text: me ? `Kết nối thành công - đang đăng nhập là ${me.display_name}.` : "Kết nối được máy chủ nhưng chưa đăng nhập.",
        ok: true,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Không kết nối được.";
      setMessage({ text: msg, ok: false });
    } finally {
      setTesting(false);
    }
  }

  async function onFaceSave() {
    setFaceMessage(null);
    if (!/^https?:\/\/.+/.test(faceUrl.trim())) {
      setFaceMessage({ text: "Địa chỉ phải bắt đầu bằng http:// hoặc https://", ok: false });
      return;
    }
    setFaceSaving(true);
    await setFaceApiUrl(faceUrl);
    setFaceSaving(false);
    setFaceMessage({ text: "Đã lưu địa chỉ Face API.", ok: true });
  }

  async function onFaceTest() {
    setFaceTesting(true);
    setFaceMessage(null);
    const result = await testFaceApiReachable(faceUrl);
    setFaceMessage({ text: result.message, ok: result.ok });
    setFaceTesting(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Cài đặt</Text>
        <Text style={styles.sectionTitle}>Địa chỉ máy chủ</Text>
        <Text style={styles.desc}>
          Địa chỉ IP LAN + cổng của server Flask (Gesture Control Web UI) đang chạy trên máy tính.
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.10:5050"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />

        {message ? (
          <View style={[styles.msgBox, { backgroundColor: message.ok ? colors.goodSoft : colors.badSoft }]}>
            <Ionicons name={message.ok ? "checkmark-circle" : "alert-circle"} size={15} color={message.ok ? colors.good : colors.bad} />
            <Text style={[styles.msgText, { color: message.ok ? colors.good : colors.bad }]}>{message.text}</Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onTest} disabled={testing} activeOpacity={0.8}>
            {testing ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.secondaryButtonText}>Kiểm tra kết nối</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={onSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#04141c" /> : <Text style={styles.primaryButtonText}>Lưu</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Cùng WiFi: dùng địa chỉ IP LAN của máy tính (trên máy ảo Android, dùng{" "}
          <Text style={styles.mono}>http://10.0.2.2:5050</Text>). Ở xa, không cùng mạng: cài Tailscale trên cả 2
          thiết bị (cùng tailnet), rồi dùng địa chỉ Tailscale của máy chủ, ví dụ{" "}
          <Text style={styles.mono}>http://100.101.102.103:5050</Text> hoặc{" "}
          <Text style={styles.mono}>http://may-tinh.tailxxxx.ts.net:5050</Text>.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Địa chỉ Face API (huấn luyện khuôn mặt)</Text>
        <Text style={styles.desc}>
          Địa chỉ IP + CỔNG của server main.py (Face Auth API) - server RIÊNG, khác với server thiết bị ở trên. Phải
          nhập đúng cổng main.py thực sự đang lắng nghe (xem ghi chú bên dưới nếu không chắc).
        </Text>
        <TextInput
          value={faceUrl}
          onChangeText={setFaceUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.92:8000"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />

        {faceMessage ? (
          <View style={[styles.msgBox, { backgroundColor: faceMessage.ok ? colors.goodSoft : colors.badSoft }]}>
            <Ionicons name={faceMessage.ok ? "checkmark-circle" : "alert-circle"} size={15} color={faceMessage.ok ? colors.good : colors.bad} />
            <Text style={[styles.msgText, { color: faceMessage.ok ? colors.good : colors.bad }]}>{faceMessage.text}</Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onFaceTest} disabled={faceTesting} activeOpacity={0.8}>
            {faceTesting ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.secondaryButtonText}>Kiểm tra kết nối</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={onFaceSave} disabled={faceSaving} activeOpacity={0.85}>
            {faceSaving ? <ActivityIndicator color="#04141c" /> : <Text style={styles.primaryButtonText}>Lưu</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.tokenRow}>
          <Text style={styles.tokenText}>Token Face API: {hasToken ? "Đã lưu" : "Chưa có (sẽ hỏi khi đăng ký khuôn mặt)"}</Text>
          {hasToken ? (
            <TouchableOpacity onPress={onClearToken}>
              <Text style={styles.tokenClear}>Xoá token</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.hint}>
          Không chắc main.py đang chạy cổng nào? Trên Pi, chạy{" "}
          <Text style={styles.mono}>sudo ss -tlnp | grep python</Text> (hoặc <Text style={styles.mono}>netstat -tlnp</Text>)
          để xem cổng thật đang lắng nghe, rồi nhập đúng cổng đó vào đây - không cần cổng phải là 8000, chỉ cần
          KHỚP với cổng main.py thật sự dùng.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 6 },
  desc: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 14,
    fontFamily: "monospace",
    marginBottom: spacing.md,
  },
  msgBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  msgText: { fontSize: 12.5, flex: 1 },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 13, alignItems: "center" },
  secondaryButtonText: { color: colors.text, fontWeight: "700", fontSize: 13.5 },
  primaryButton: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: "#04141c", fontWeight: "800", fontSize: 13.5 },
  mono: { fontFamily: "monospace", color: colors.text },
  hint: { color: colors.textFaint, fontSize: 11.5, marginTop: spacing.xl, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  tokenRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
  tokenText: { color: colors.textDim, fontSize: 12.5, flex: 1 },
  tokenClear: { color: colors.bad, fontSize: 12.5, fontWeight: "700" },
});
