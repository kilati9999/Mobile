import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing } from "../theme";

interface Props {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string | number;
  suffix?: string;
  tint?: string;
}

export default function KpiCard({ icon, label, value, suffix, tint = colors.accent }: Props) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={[styles.iconWrap, { backgroundColor: tint + "1f" }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value}>
        {value}
        {suffix ? <Text style={styles.suffix}> {suffix}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minWidth: 132,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  label: { color: colors.textDim, fontSize: 11.5, fontWeight: "600", marginBottom: 4 },
  value: { color: colors.text, fontSize: 20, fontWeight: "800" },
  suffix: { color: colors.textDim, fontSize: 12, fontWeight: "500" },
});
