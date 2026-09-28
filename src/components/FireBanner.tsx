import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getSensors } from "../api/client";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing } from "../theme";

export default function FireBanner() {
  const { data } = usePolling(getSensors, 4000);
  const affected = (data?.sites || []).filter((s) => s.fire_alert);
  if (!affected.length) return null;

  return (
    <View style={styles.wrap}>
      {affected.map((s) => (
        <View key={s.site_id} style={styles.banner}>
          <Ionicons name="flame" size={16} color={colors.bad} />
          <Text style={styles.text}>
            <Text style={styles.strong}>{s.site_name}</Text> đang nghi ngờ có cháy — nhiệt độ {s.temperature}°C,
            khí gas {s.gas} ppm.
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.badSoft,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  text: { color: "#fca5a5", fontSize: 12, flex: 1, lineHeight: 17 },
  strong: { fontWeight: "800", color: "#fecaca" },
});
