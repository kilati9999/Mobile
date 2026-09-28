import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { getSensors } from "../api/client";
import type { SensorSite } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing } from "../theme";
import MiniChart from "./MiniChart";

const CHART_WIDTH = Dimensions.get("window").width - spacing.lg * 4;

function SiteSensorCard({ site }: { site: SensorSite }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{site.site_name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.sourceChip, site.source === "real" ? styles.sourceChipReal : styles.sourceChipSim]}>
            <Text style={[styles.sourceChipText, { color: site.source === "real" ? colors.good : colors.textFaint }]}>
              {site.source === "real" ? "● Dữ liệu thật" : "○ Mô phỏng"}
            </Text>
          </View>
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

export default function SensorSection() {
  const { data } = usePolling(getSensors, 2000);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Cảm biến môi trường &amp; cảnh báo cháy</Text>
      {(data?.sites || []).map((s) => (
        <SiteSensorCard key={s.site_id} site={s} />
      ))}
      <Text style={styles.hint}>Xem đầy đủ nhật ký cảnh báo cháy ở tab Khác → Nhật ký.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.sm },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md, flexWrap: "wrap", gap: 6 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sourceChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sourceChipReal: { backgroundColor: colors.goodSoft },
  sourceChipSim: { backgroundColor: "rgba(137,147,163,0.12)" },
  sourceChipText: { fontSize: 10, fontWeight: "700" },
  fireChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.badSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  fireChipText: { color: colors.bad, fontSize: 10.5, fontWeight: "700" },
  okChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.goodSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  okChipText: { color: colors.good, fontSize: 10.5, fontWeight: "700" },
  metricRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  metric: { alignItems: "flex-start" },
  metricLabel: { color: colors.textFaint, fontSize: 10.5, marginBottom: 2 },
  metricVal: { color: colors.text, fontSize: 16, fontWeight: "800", fontFamily: "monospace" },

  hint: { color: colors.textFaint, fontSize: 11, textAlign: "center", marginTop: 2 },
});
