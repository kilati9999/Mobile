import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getServerUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, gradients, radius, spacing, typography } from "../theme";

export default function LoginScreen() {
  const { login, forgetServer } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrlDisplay] = useState("");

  useEffect(() => {
    getServerUrl().then(setServerUrlDisplay);
  }, []);

  async function onSubmit() {
    if (!username.trim() || !password) {
      setError("Nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.payload?.error || e.message : "Không thể đăng nhập, thử lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={gradients.signal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badgeBar} />
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="hand-left" size={22} color="#04141c" />
            </View>
            <View>
              <Text style={styles.brandTitle}>SmartHome</Text>
              <Text style={styles.brandSub}>Điều khiển thiết bị bằng cử chỉ tay</Text>
            </View>
          </View>

          <Text style={styles.h1}>Đăng nhập</Text>
          <Text style={styles.desc}>Dùng tài khoản đã cấp trên hệ thống Gesture Control để tiếp tục.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={15} color={colors.bad} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="admin"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              onSubmitEditing={onSubmit}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#04141c" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
          </TouchableOpacity>

          <View style={styles.serverBox}>
            <Ionicons name="server" size={13} color={colors.textFaint} />
            <Text style={styles.serverText} numberOfLines={1}>
              {serverUrl || "Chưa đặt địa chỉ máy chủ"}
            </Text>
          </View>
          <TouchableOpacity onPress={forgetServer} style={styles.changeServerLink}>
            <Text style={styles.changeServerText}>Đổi địa chỉ máy chủ khác</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl },
  badgeBar: { height: 3, borderRadius: 3, width: 52, marginBottom: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xxl },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  brandSub: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  h1: { ...typography.h1, color: colors.text, marginBottom: 6 },
  desc: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: spacing.xl },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.badSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: "#fca5a5", fontSize: 12.5, flex: 1 },
  field: { marginBottom: spacing.lg },
  label: { color: colors.textDim, fontSize: 12.5, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
  },
  button: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm },
  buttonText: { color: "#04141c", fontWeight: "800", fontSize: 15 },
  serverBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  serverText: { color: colors.textFaint, fontSize: 11, fontFamily: "monospace" },
  changeServerLink: { alignItems: "center", marginTop: spacing.sm, padding: spacing.sm },
  changeServerText: { color: colors.accent, fontSize: 12.5, fontWeight: "700" },
});
