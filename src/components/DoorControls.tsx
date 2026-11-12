import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ApiError, doorCommand } from "../api/client";
import type { Device, DoorCmd } from "../api/types";
import { colors, radius, spacing } from "../theme";
import { doorButtons, doorCmdDisabled } from "../utils/door";

interface Props {
  device: Device;
  size?: "compact" | "large";
  onDone?: () => void;
}

/** Nút Lên / Dừng / Xuống cho cửa cuốn (ESP32 slot "door"); cửa Touch4 chỉ có Mở / Đóng. */
export default function DoorControls({ device, size = "compact", onDone }: Props) {
  const [busy, setBusy] = useState<DoorCmd | null>(null);
  const large = size === "large";

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
    <View style={[styles.row, large && styles.rowLarge]}>
      {doorButtons(device).map((b) => {
        const disabled = busy !== null || doorCmdDisabled(device, b.cmd);
        const isStop = b.cmd === "stop";
        const tint = isStop ? colors.bad : colors.accent;
        return (
          <TouchableOpacity
            key={b.cmd}
            onPress={() => send(b.cmd)}
            disabled={disabled}
            activeOpacity={0.7}
            hitSlop={large ? undefined : { top: 6, bottom: 6, left: 3, right: 3 }}
            style={[
              large ? styles.btnLarge : styles.btn,
              { borderColor: tint + "66", backgroundColor: tint + "1a" },
              disabled && styles.disabled,
            ]}
          >
            {busy === b.cmd ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <>
                <Ionicons name={b.icon as any} size={large ? 20 : 15} color={tint} />
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
  rowLarge: { gap: spacing.sm, marginTop: spacing.md },
  btn: { width: 30, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnLarge: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.35 },
});
