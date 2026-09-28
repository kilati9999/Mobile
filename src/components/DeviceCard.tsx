import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import type { Device } from "../api/types";
import { colors, deviceMeta, ESP_STATUS_META, radius, shadow, spacing, STATUS_META } from "../theme";

interface Props {
  device: Device;
  variant?: "tile" | "row";
  canControl: boolean;
  busy?: boolean;
  onPress: () => void;
  onToggle: () => void;
}

function subtitleFor(device: Device): string {
  if (device.status !== "ok") return STATUS_META[device.status]?.label || device.status_label;
  if (device.type === "door") return device.state ? "Đang mở" : "Đã khoá";
  if (!device.state) return "Đang tắt";
  if (device.type === "dimmer") return `Độ sáng ${device.level ?? 0}%`;
  if (device.type === "speed") return `Tốc độ mức ${device.level ?? 0}`;
  return "Đang bật";
}

export default function DeviceCard({ device, variant = "tile", canControl, busy, onPress, onToggle }: Props) {
  const meta = deviceMeta(device.type);
  const unhealthy = device.status !== "ok";
  const espMeta = ESP_STATUS_META[device.esp_status];

  if (variant === "row") {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.row, shadow.card]}>
        <View style={[styles.iconWrap, { backgroundColor: meta.color + "1f" }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.name} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {device.site_name} · {subtitleFor(device)}
          </Text>
          <View style={styles.rowBadges}>
            <View style={[styles.miniDot, { backgroundColor: espMeta.color }]} />
            <Text style={[styles.miniText, { color: espMeta.color }]} numberOfLines={1}>
              {espMeta.label}
            </Text>
            {device.mac ? (
              <Text style={styles.macText} numberOfLines={1}>
                {device.mac}
              </Text>
            ) : null}
          </View>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : canControl ? (
          <Switch
            value={device.state}
            onValueChange={onToggle}
            disabled={unhealthy}
            trackColor={{ false: colors.cardAlt, true: colors.accent }}
            thumbColor={colors.text}
          />
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.tile, shadow.card, device.state && !unhealthy && styles.tileActive]}>
      <View style={styles.tileTop}>
        <View style={[styles.iconWrap, { backgroundColor: meta.color + "1f" }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : canControl ? (
          <Switch
            value={device.state}
            onValueChange={onToggle}
            disabled={unhealthy}
            trackColor={{ false: colors.cardAlt, true: colors.accent }}
            thumbColor={colors.text}
            style={styles.tileSwitch}
          />
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {device.name}
      </Text>
      <Text style={[styles.tileSub, unhealthy && { color: colors.bad }]} numberOfLines={1}>
        {subtitleFor(device)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 118,
    minWidth: "45%",
  },
  tileActive: { borderColor: colors.accent + "55" },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  tileSwitch: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  tileSub: { color: colors.textFaint, fontSize: 11.5, marginTop: 3 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowSub: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  rowBadges: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  miniDot: { width: 5, height: 5, borderRadius: 2.5 },
  miniText: { fontSize: 10.5, fontWeight: "700" },
  macText: { fontSize: 10, color: colors.textFaint, fontFamily: "monospace", marginLeft: 4 },
});
