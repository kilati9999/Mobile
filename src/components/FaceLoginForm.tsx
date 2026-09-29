import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FaceApiError } from "../api/faceApi";
import { colors, radius, spacing, typography } from "../theme";

interface Props {
  onSubmit: (username: string, password: string) => Promise<unknown>;
}

export default function FaceLoginForm({ onSubmit }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError("Nhập đầy đủ tài khoản và mật khẩu.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(username.trim(), password);
    } catch (e) {
      setError(e instanceof FaceApiError ? e.message : "Không đăng nhập được, thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Đăng nhập Face API</Text>
      <Text style={styles.subtitle}>
        Dùng đúng tài khoản/mật khẩu bạn đang dùng để đăng nhập ứng dụng này - hệ thống tự xác thực qua server chính,
        không cần token riêng.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Tên đăng nhập"
        placeholderTextColor={colors.textFaint}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        placeholderTextColor={colors.textFaint}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#04141c" /> : <Text style={styles.primaryBtnText}>Đăng nhập</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: "center" },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { color: colors.textDim, fontSize: 13.5, marginBottom: spacing.xl, lineHeight: 20 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.bad, fontSize: 12.5, marginBottom: spacing.md, textAlign: "center" },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#04141c", fontSize: 15, fontWeight: "800" },
});
