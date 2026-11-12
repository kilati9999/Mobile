import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { ApiError, doorCommand } from "../api/client";
import type { Device, DoorCmd } from "../api/types";
import { colors, deviceMeta } from "../theme";
import { isDoorMoving, isRollerDoor, isTouch4Door } from "../utils/door";

interface Props {
  device: Device;
  canControl: boolean;
  busy?: boolean;
  size?: number;
  /** Đèn / quạt / ổ cắm: bật-tắt. Cửa tự gửi lệnh Mở / Đóng / Dừng. */
  onToggle: () => void;
}

/** Cửa đang mở? (Touch4: state; ESP32: door_state) */
function doorIsOpen(d: Device): boolean {
  if (isTouch4Door(d)) return !!d.state;
  return d.door_state === "OPEN" || d.door_state === "OPENING";
}

/** Bấm nút tròn của cửa: đang chạy -> Dừng, đang mở -> Đóng, còn lại -> Mở. */
function nextDoorCmd(d: Device): DoorCmd {
  if (!isTouch4Door(d) && isDoorMoving(d)) return "stop";
  return doorIsOpen(d) ? "close" : "open";
}

function iconFor(d: Device, on: boolean): string {
  if (isRollerDoor(d) || d.type === "door") {
    if (!isTouch4Door(d) && isDoorMoving(d)) return "stop";
    return on ? "garage-open-variant" : "garage-variant";
  }
  if (d.type === "dimmer") return on ? "lightbulb-on" : "lightbulb-outline";
  if (d.type === "speed") return "fan";
  return "power";
}

/** Nút tròn to, biểu tượng thiết bị ở giữa: sáng màu khi bật / cửa mở, tối khi tắt / cửa đóng. */
export default function DevicePowerButton({ device, canControl, busy, size = 92, onToggle }: Props) {
  const meta = deviceMeta(device.type);
  const door = isRollerDoor(device);
  const on = door ? doorIsOpen(device) : !!device.state;
  const unhealthy = device.status !== "ok";
  const [doorBusy, setDoorBusy] = useState(false);
  const loading = !!busy || doorBusy;
  const disabled = !canControl || unhealthy || loading;
  const tint = unhealthy ? colors.textFaint : meta.color;

  // Quạt đang bật: cánh quạt quay (style xoay luôn gắn cố định, chỉ chạy / dừng vòng quay)
  const spin = useRef(new Animated.Value(0)).current;
  const spinning = device.type === "speed" && on && !unhealthy;
  useEffect(() => {
    if (!spinning) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  async function press() {
    if (disabled) return;
    if (!door) {
      onToggle();
      return;
    }
    setDoorBusy(true);
    try {
      await doorCommand(device.id, nextDoorCmd(device));
    } catch (e) {
      const msg = e instanceof ApiError ? e.payload?.reason || e.message : "Không thể điều khiển cửa lúc này.";
      Alert.alert("Không gửi được lệnh cửa", msg);
    } finally {
      setDoorBusy(false);
    }
  }

  const iconSize = Math.round(size * 0.46);
  const label = door
    ? nextDoorCmd(device) === "stop" ? "Dừng cửa" : on ? "Đóng cửa" : "Mở cửa"
    : on ? `Tắt ${device.name}` : `Bật ${device.name}`;

  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole={door ? "button" : "switch"}
      accessibilityLabel={label}
      accessibilityState={{ checked: door ? undefined : on, disabled, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2 },
        on && !unhealthy
          ? { backgroundColor: tint, borderColor: tint, shadowColor: tint, shadowOpacity: 0.55, shadowRadius: 16, elevation: 10 }
          : { backgroundColor: colors.cardAlt, borderColor: tint + "55" },
        !canControl && styles.readOnly,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={on ? colors.bg : tint} />
      ) : (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <MaterialCommunityIcons name={iconFor(device, on) as any} size={iconSize} color={on && !unhealthy ? colors.bg : tint} />
        </Animated.View>
      )}
      {device.type === "speed" && !on && !loading ? <View style={[styles.offSlash, { backgroundColor: tint }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: { transform: [{ scale: 0.94 }] },
  readOnly: { opacity: 0.6 },
  // gạch chéo nhẹ trên quạt khi tắt (để thấy rõ tắt/bật cả khi không nhìn màu)
  offSlash: { position: "absolute", width: "52%", height: 2.5, borderRadius: 2, transform: [{ rotate: "-45deg" }], opacity: 0.7 },
});
