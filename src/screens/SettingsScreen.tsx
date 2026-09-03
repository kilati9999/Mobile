import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiMe, getServerUrl, setServerUrl } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";

export default function SettingsScreen() {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getServerUrl().then(setUrl);
  }, []);

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
});
