import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHistory } from "../api/client";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing, typography } from "../theme";

export default function HistoryScreen() {
  const { data } = usePolling(getHistory, 1500);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Lịch sử lệnh</Text>
        <Text style={styles.subtitle}>Tối đa 200 dòng gần nhất</Text>
      </View>
      <FlatList
        data={data || []}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có lệnh nào được ghi nhận…</Text>}
        renderItem={({ item }) => (
          <View style={[styles.item, !item.applied && styles.itemBlocked]}>
            <View style={styles.itemTop}>
              <Text style={styles.time}>{item.time}</Text>
              <Text style={styles.hand}>{item.hand}</Text>
              <Text style={styles.conf}>{Math.round((item.confidence || 0) * 100)}%</Text>
            </View>
            <Text style={styles.main}>
              {item.gesture} → {item.action} · <Text style={{ fontWeight: "700" }}>{item.device}</Text>
            </Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.xxl },
  item: { backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.good },
  itemBlocked: { borderLeftColor: colors.bad, opacity: 0.8 },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  time: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  hand: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  conf: { color: colors.accent, fontSize: 10.5, fontFamily: "monospace", marginLeft: "auto" },
  main: { color: colors.text, fontSize: 12.5 },
  note: { color: colors.bad, fontSize: 11, marginTop: 3 },
});
