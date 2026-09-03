import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSensors } from "../api/client";
import type { SensorSite } from "../api/types";
import MiniChart from "../components/MiniChart";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing, typography } from "../theme";

const CHART_WIDTH = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;

function SiteSensorCard({ site }: { site: SensorSite }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{site.site_name}</Text>
        {site.fire_alert ? (
          <View style={styles.fireChip}>
            <Ionicons name="flame" size={12} color={colors.bad} />
            <Text style={styles.fireChipText}>Nghi ngờ cháy</Text>
          </View>
        ) : (
          <View style={styles.okChip}>
            <Ionicons name="checkmark-circle" size={12} color={colors.good} />
            <Text style={styles.okChipText}>Bình thường</Text>
          </View>
        )}
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Nhiệt độ</Text>
          <Text style={[styles.metricVal, site.fire_alert && { color: colors.bad }]}>{site.temperature}°C</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Độ ẩm</Text>
          <Text style={styles.metricVal}>{site.humidity}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Khí gas</Text>
          <Text style={[styles.metricVal, site.fire_alert && { color: colors.bad }]}>{site.gas} ppm</Text>
        </View>
      </View>

      <MiniChart values={site.history.map((h) => h.temperature)} color={colors.bad} width={CHART_WIDTH} />
    </View>
  );
}

export default function SensorsScreen() {
  const { data } = usePolling(getSensors, 1500);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cảm biến &amp; cảnh báo</Text>
        <Text style={styles.subtitle}>Nhiệt độ · độ ẩm · khí gas theo từng vị trí</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {(data?.sites || []).map((s) => (
          <SiteSensorCard key={s.site_id} site={s} />
        ))}

        <Text style={styles.sectionTitle}>Nhật ký cảnh báo</Text>
        {(data?.alerts || []).length === 0 && <Text style={styles.empty}>Chưa có cảnh báo nào…</Text>}
        {(data?.alerts || []).map((a) => (
          <View key={a.id} style={[styles.alertItem, a.type !== "fire" && styles.alertItemCleared]}>
            <View style={styles.alertTop}>
              <Text style={styles.alertTime}>{a.time}</Text>
              <Text style={styles.alertSite}>{a.site_name}</Text>
            </View>
            <Text style={styles.alertMsg}>{a.message}</Text>
          </View>
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  fireChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.badSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  fireChipText: { color: colors.bad, fontSize: 10.5, fontWeight: "700" },
  okChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.goodSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  okChipText: { color: colors.good, fontSize: 10.5, fontWeight: "700" },
  metricRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  metric: { alignItems: "flex-start" },
  metricLabel: { color: colors.textFaint, fontSize: 10.5, marginBottom: 2 },
  metricVal: { color: colors.text, fontSize: 16, fontWeight: "800", fontFamily: "monospace" },

  sectionTitle: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.sm },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.lg },
  alertItem: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.bad },
  alertItemCleared: { borderLeftColor: colors.good },
  alertTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  alertTime: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  alertSite: { color: colors.textFaint, fontSize: 10.5 },
  alertMsg: { color: colors.text, fontSize: 12.5 },
});
