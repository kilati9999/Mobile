import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getDevices, setDeviceLevel, toggleDevice } from "../api/client";
import type { Device } from "../api/types";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, deviceMeta, ESP_STATUS_META, radius, spacing, STATUS_META, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DeviceDetail">;

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function DeviceDetailScreen({ route }: Props) {
  const { deviceId } = route.params;
  const { user } = useAuth();
  const canControl = user?.role === "admin";
  const [device, setDevice] = useState<Device | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    const devices = await getDevices();
    const found = devices.find((d) => d.id === deviceId) || null;
    setDevice(found);
    if (found?.level !== null && found?.level !== undefined) setSliderValue(found.level);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  if (!device) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const meta = deviceMeta(device.type);
  const statusMeta = STATUS_META[device.status];
  const espMeta = ESP_STATUS_META[device.esp_status];
  const hasLevel = device.type === "dimmer" || device.type === "speed";
  const maxLevel = device.type === "dimmer" ? 100 : 5;

  async function handleToggle() {
    setSaving(true);
    try {
      await toggleDevice(device!.id);
    } catch (e) {
      if (e instanceof ApiError) console.warn(e.payload?.reason || e.message);
    } finally {
      setSaving(false);
      load();
    }
  }

  async function handleSlideComplete(value: number) {
    setSaving(true);
    try {
      await setDeviceLevel(device!.id, Math.round(value));
    } catch (e) {
      if (e instanceof ApiError) console.warn(e.payload?.reason || e.message);
    } finally {
      setSaving(false);
      load();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIconWrap}>
          <View style={[styles.heroIcon, { backgroundColor: meta.color + "1f" }]}>
            <Ionicons name={meta.icon as any} size={34} color={meta.color} />
          </View>
        </View>
        <Text style={styles.name}>{device.name}</Text>
        <Text style={styles.siteLine}>
          {device.site_name} · {meta.label}
        </Text>

        <View style={styles.pillRow}>
          <StatusPill label={statusMeta.label} color={statusMeta.color} />
          <StatusPill label={espMeta.label} color={espMeta.color} />
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.cardTitle}>Nguồn</Text>
              <Text style={styles.cardSub}>{device.state ? "Đang bật" : "Đang tắt"}</Text>
            </View>
            {saving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Switch
                value={device.state}
                onValueChange={handleToggle}
                disabled={!canControl || device.status !== "ok"}
                trackColor={{ false: colors.cardAlt, true: colors.accent }}
                thumbColor={colors.text}
              />
            )}
          </View>

          {hasLevel && (
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHead}>
                <Text style={styles.cardTitle}>{device.type === "dimmer" ? "Độ sáng" : "Tốc độ"}</Text>
                <Text style={styles.sliderVal}>
                  {Math.round(sliderValue)}
                  {device.type === "dimmer" ? "%" : ""}
                </Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={maxLevel}
                step={1}
                value={sliderValue}
                disabled={!canControl || device.status !== "ok"}
                onValueChange={setSliderValue}
                onSlidingComplete={handleSlideComplete}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.cardAlt}
                thumbTintColor={colors.accent}
              />
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Kết nối &amp; cấu hình</Text>
        <View style={styles.card}>
          <InfoRow label="Người phụ trách" value={device.assigned_user || "Chưa gán"} />
          <InfoRow label="MAC / Chip ID ESP32" value={device.mac || "Chưa gán"} mono />
          <InfoRow label="Địa chỉ IP" value={device.ip || "—"} mono />
          <InfoRow label="Nguồn điện" value={device.power_source + (device.battery !== null ? ` · ${device.battery}%` : "")} />
          <InfoRow label="Cập nhật lúc" value={device.last_seen || "—"} mono />
          {device.error_reason ? <InfoRow label="Lý do lỗi" value={device.error_reason} /> : null}
        </View>

        {!canControl && (
          <Text style={styles.viewOnlyNote}>Tài khoản của bạn chỉ có thể xem thông tin thiết bị này.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroIconWrap: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  name: { ...typography.h1, color: colors.text, textAlign: "center" },
  siteLine: { color: colors.textDim, fontSize: 12.5, textAlign: "center", marginTop: 4, marginBottom: spacing.md },
  pillRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  cardSub: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  sliderBlock: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  sliderHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sliderVal: { color: colors.accent, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  sectionTitle: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textFaint, fontSize: 12.5 },
  infoValue: { color: colors.text, fontSize: 12.5, fontWeight: "600", maxWidth: "60%" },
  mono: { fontFamily: "monospace" },
  viewOnlyNote: { color: colors.textFaint, fontSize: 11.5, textAlign: "center", marginTop: spacing.sm },
});
