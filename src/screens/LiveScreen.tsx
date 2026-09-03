import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getState } from "../api/client";
import type { HandState, HistoryEntry } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing, typography } from "../theme";

const DEBOUNCE_FRAMES = 6;

function HandCard({ label, hand, tint }: { label: string; hand: HandState | undefined; tint: string }) {
  const confidence = Math.round((hand?.confidence || 0) * 100);
  const buffer = hand?.buffer || 0;
  return (
    <View style={[styles.handCard, { borderTopColor: tint }]}>
      <View style={styles.handHead}>
        <View style={styles.handLabelRow}>
          <View style={[styles.swatch, { backgroundColor: tint }]} />
          <Text style={styles.handLabel}>{label}</Text>
        </View>
        <View style={styles.trackRow}>
          <View style={[styles.trackDot, { backgroundColor: hand?.tracked ? colors.good : colors.textFaint }]} />
          <Text style={[styles.trackText, { color: hand?.tracked ? colors.good : colors.textFaint }]}>
            {hand?.tracked ? "Đang theo dõi" : "Mất theo dõi"}
          </Text>
        </View>
      </View>

      <Text style={styles.gesture}>{hand?.tracked ? hand.gesture : "—"}</Text>
      <Text style={styles.updatedAt}>{hand?.updated_at ? `cập nhật ${hand.updated_at}` : "chưa có dữ liệu"}</Text>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>Độ tin cậy</Text>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${confidence}%`, backgroundColor: tint }]} />
        </View>
        <Text style={styles.meterVal}>{confidence}%</Text>
      </View>

      <View style={styles.bufferRow}>
        {Array.from({ length: DEBOUNCE_FRAMES }).map((_, i) => (
          <View key={i} style={[styles.bufferCell, i < buffer && { backgroundColor: colors.accent }]} />
        ))}
      </View>
    </View>
  );
}

function FeedItem({ entry }: { entry: HistoryEntry }) {
  return (
    <View style={[styles.feedItem, !entry.applied && styles.feedItemBlocked]}>
      <View style={styles.feedTop}>
        <Text style={styles.feedTime}>{entry.time}</Text>
        <Text style={styles.feedHand}>{entry.hand}</Text>
      </View>
      <Text style={styles.feedMain}>
        {entry.gesture} → {entry.action} · <Text style={{ fontWeight: "700" }}>{entry.device}</Text>
      </Text>
      {entry.note ? <Text style={styles.feedNote}>{entry.note}</Text> : null}
    </View>
  );
}

export default function LiveScreen() {
  const { data } = usePolling(getState, 900);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Trực tiếp</Text>
        <Text style={styles.subtitle}>Buffer &amp; độ tin cậy theo thời gian thực cho từng tay</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <HandCard label="Tay trái" hand={data?.hands["Trái"]} tint={colors.violet} />
        <HandCard label="Tay phải" hand={data?.hands["Phải"]} tint={colors.sky} />

        <View style={styles.sectionHead}>
          <Ionicons name="time" size={13} color={colors.textFaint} />
          <Text style={styles.sectionTitle}>Nhật ký gần đây</Text>
        </View>
        {(data?.history || []).length === 0 && <Text style={styles.empty}>Chưa có lệnh nào được xác nhận…</Text>}
        {(data?.history || []).map((h) => (
          <FeedItem key={h.id} entry={h} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  handCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  handHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  handLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  handLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trackDot: { width: 7, height: 7, borderRadius: 3.5 },
  trackText: { fontSize: 11, fontWeight: "600" },
  gesture: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 2 },
  updatedAt: { color: colors.textFaint, fontSize: 11, fontFamily: "monospace", marginBottom: spacing.md },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  meterLabel: { color: colors.textFaint, fontSize: 11, width: 64 },
  meterTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.cardAlt, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 999 },
  meterVal: { color: colors.text, fontSize: 12, fontFamily: "monospace", width: 36, textAlign: "right" },
  bufferRow: { flexDirection: "row", gap: 5 },
  bufferCell: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.cardAlt },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },

  feedItem: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.good },
  feedItemBlocked: { borderLeftColor: colors.bad, opacity: 0.75 },
  feedTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  feedTime: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  feedHand: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  feedMain: { color: colors.text, fontSize: 12.5 },
  feedNote: { color: colors.bad, fontSize: 11, marginTop: 3 },
});
