import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing } from "../theme";

interface State {
  error: Error | null;
  stack: string | null;
}

/** Lỗi JS khi vẽ giao diện -> hiện nội dung lỗi (thay vì màn hình đen) + nút thử lại. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ stack: info.componentStack || null });
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>App gặp lỗi</Text>
        <Text style={styles.hint}>Chụp màn hình này gửi lại để sửa.</Text>
        <ScrollView style={styles.box} contentContainerStyle={{ padding: spacing.md }}>
          <Text style={styles.msg}>{String(error?.message || error)}</Text>
          {stack ? <Text style={styles.stack}>{stack.trim().split("\n").slice(0, 12).join("\n")}</Text> : null}
        </ScrollView>
        <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null, stack: null })}>
          <Text style={styles.btnText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 60 },
  title: { color: colors.bad, fontSize: 20, fontWeight: "800" },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  box: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  msg: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  stack: { color: colors.textFaint, fontSize: 11, fontFamily: "monospace" },
  btn: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: "800" },
});
