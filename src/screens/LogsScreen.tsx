import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHistory } from "../api/client";
import type { HistoryEntry } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing, typography } from "../theme";

function CommandRow({ item }: { item: HistoryEntry }) {
  return (
    <View style={[styles.item, !item.applied && styles.itemBlocked]}>
      <View style={styles.itemTop}>
        <Text style={styles.time}>{item.time}</Text>
        <Text style={styles.hand}>{item.hand || "Cửa"}</Text>
        <Text style={styles.conf}>{Math.round((item.confidence || 0) * 100)}%</Text>
      </View>
      <Text style={styles.main}>
        {item.gesture ? `${item.gesture} → ` : ""}
        {item.action} · <Text style={{ fontWeight: "700" }}>{item.device}</Text>
      </Text>
      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
    </View>
  );
}

export default function LogsScreen() {
  const { data: history } = usePolling(getHistory, 1500);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Nhật ký</Text>
        <Text style={styles.subtitle}>Lệnh cử chỉ đã ghi nhận</Text>
      </View>

      <FlatList
        data={history || []}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có lệnh nào được ghi nhận…</Text>}
        renderItem={({ item }) => <CommandRow item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },

  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tabText: { color: colors.textDim, fontSize: 12.5, fontWeight: "700" },
  tabTextActive: { color: colors.text },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.xxl },
  item: { backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.good },
  itemBlocked: { borderLeftColor: colors.bad, opacity: 0.8 },
  itemCleared: { borderLeftColor: colors.good },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  time: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  hand: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  conf: { color: colors.accent, fontSize: 10.5, fontFamily: "monospace", marginLeft: "auto" },
  main: { color: colors.text, fontSize: 12.5 },
  note: { color: colors.bad, fontSize: 11, marginTop: 3 },
});
