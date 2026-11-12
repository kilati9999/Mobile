import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Device } from "../api/types";
import { colors, connStatusMeta, deviceMeta, radius, shadow, spacing, STATUS_META } from "../theme";
import { doorStateLabel, isDoorMoving, isRollerDoor } from "../utils/door";
import DevicePowerButton from "./DevicePowerButton";
import DoorControls from "./DoorControls";

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
  if (isRollerDoor(device)) return doorStateLabel(device);
  if (device.type === "door") return device.state ? "Đang mở" : "Đã đóng";
  if (!device.state) return "Đang tắt";
  return "Đang bật";
}

export default function DeviceCard({ device, variant = "tile", canControl, busy, onPress, onToggle }: Props) {
  const meta = deviceMeta(device.type);
  const unhealthy = device.status !== "ok";
  const espMeta = connStatusMeta(device);
  const rollerDoor = isRollerDoor(device);
  const active = rollerDoor ? device.door_state === "OPEN" || isDoorMoving(device) : device.state;

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
          {rollerDoor && canControl ? (
            <View style={styles.rowDoor}>
              <DoorControls device={device} />
            </View>
          ) : null}
        </View>
<<<<<<< HEAD
        {rollerDoor ? (
          <DoorControls device={device} size="medium" canControl={canControl} />
        ) : (
=======
        {rollerDoor ? null : (
>>>>>>> 5ffeab882af5440d7d6149972ed96014e141ee96
          <DevicePowerButton device={device} canControl={canControl} busy={busy} size={54} onToggle={onToggle} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.tile, shadow.card, active && !unhealthy && { borderColor: meta.color + "66" }]}>
      <View style={styles.tileTop}>
        <Text style={[styles.name, styles.tileName]} numberOfLines={1}>
          {device.name}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
      </View>
      <View style={styles.tileCenter}>
        {rollerDoor ? (
<<<<<<< HEAD
          <DoorControls device={device} size="tile" canControl={canControl} />
=======
          <View style={[styles.doorIcon, { backgroundColor: meta.color + "1f", borderColor: meta.color + "55" }]}>
            <Ionicons name={meta.icon as any} size={40} color={unhealthy ? colors.textFaint : meta.color} />
          </View>
>>>>>>> 5ffeab882af5440d7d6149972ed96014e141ee96
        ) : (
          <DevicePowerButton device={device} canControl={canControl} busy={busy} onToggle={onToggle} />
        )}
      </View>
      <Text
        style={[styles.tileSub, active && !unhealthy && { color: meta.color }, unhealthy && { color: colors.bad }]}
        numberOfLines={1}
      >
        {subtitleFor(device)}
      </Text>
      {rollerDoor && canControl ? (
        <View style={styles.tileDoor}>
          <DoorControls device={device} />
        </View>
      ) : null}
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
    minWidth: "45%",
  },
  tileTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  tileName: { flex: 1, textAlign: "center", marginLeft: 15 },
  tileCenter: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  tileSub: { color: colors.textFaint, fontSize: 12.5, fontWeight: "600", textAlign: "center" },
<<<<<<< HEAD
=======
  tileDoor: { marginTop: spacing.sm },
  doorIcon: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, alignItems: "center", justifyContent: "center" },
>>>>>>> 5ffeab882af5440d7d6149972ed96014e141ee96

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
  rowDoor: { marginTop: spacing.sm },
  macText: { fontSize: 10, color: colors.textFaint, fontFamily: "monospace", marginLeft: 4 },
});
