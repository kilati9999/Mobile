import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ApiError, doorCommand } from "../api/client";
import type { Device, DoorCmd } from "../api/types";
import { colors, radius, spacing } from "../theme";
import { doorButtons, doorCmdDisabled } from "../utils/door";

interface Props {
  device: Device;
  /** compact: nút nhỏ; medium: hàng danh sách; tile: ô lưới (3 nút chia đều bề ngang); large: màn chi tiết. */
  size?: "compact" | "medium" | "tile" | "large";
  /** false = chỉ xem (khoá cả 3 nút). */
  canControl?: boolean;
  onDone?: () => void;
}

/** Nút Lên / Dừng / Xuống cho cửa cuốn (ESP32 slot "door"); cửa Touch4 cũng có đủ 3 nút (Dừng = nhấn lại nút Touch4). */
export default function DoorControls({ device, size = "compact", canControl = true, onDone }: Props) {
  const [busy, setBusy] = useState<DoorCmd | null>(null);
  const large = size === "large";
  const iconSize = { compact: 15, medium: 22, tile: 28, large: 40 }[size];

  async function send(cmd: DoorCmd) {
    setBusy(cmd);
    try {
      await doorCommand(device.id, cmd);
    } catch (e) {
      const msg = e instanceof ApiError ? e.payload?.reason || e.message : "Không thể điều khiển cửa lúc này.";
      Alert.alert("Không gửi được lệnh cửa", msg);
    } finally {
      setBusy(null);
      onDone?.();
    }
  }

  return (
    <View style={[styles.row, large && styles.rowLarge, size === "tile" && styles.rowTile]}>
      {doorButtons(device).map((b) => {
        const disabled = !canControl || busy !== null || doorCmdDisabled(device, b.cmd);
        const isStop = b.cmd === "stop";
        const tint = isStop ? colors.bad : colors.accent;
        return (
          <TouchableOpacity
            key={b.cmd}
            onPress={() => send(b.cmd)}
            disabled={disabled}
            activeOpacity={0.7}
            hitSlop={size === "compact" ? { top: 6, bottom: 6, left: 3, right: 3 } : undefined}
            style={[
              { compact: styles.btn, medium: styles.btnMedium, tile: styles.btnTile, large: styles.btnLarge }[size],
              { borderColor: tint + "66", backgroundColor: tint + "1a" },
              disabled && styles.disabled,
            ]}
          >
            {busy === b.cmd ? (
              <ActivityIndicator size={large || size === "tile" ? "large" : "small"} color={tint} />
            ) : (
              <>
                <Ionicons name={b.icon as any} size={iconSize} color={tint} />
                {large ? (
                  <Text style={[styles.label, { color: tint }]}>{device.door_manual ? b.manual : b.auto}</Text>
                ) : null}
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 5 },
  rowLarge: { gap: spacing.md, marginTop: spacing.lg },
  rowTile: { gap: spacing.sm, alignSelf: "stretch" },
  btnMedium: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  btnTile: { flex: 1, height: 58, borderRadius: radius.sm, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  btn: { width: 30, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnLarge: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
    minHeight: 110,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 17, fontWeight: "800" },
  disabled: { opacity: 0.35 },
});
