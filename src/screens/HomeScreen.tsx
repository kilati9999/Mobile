import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getState, toggleDevice } from "../api/client";
import type { Device } from "../api/types";
import KpiCard from "../components/KpiCard";
import RoomSection from "../components/RoomSection";
import { useAuth } from "../context/AuthContext";
import { usePolling } from "../hooks/usePolling";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data, refresh } = usePolling(getState, 1500);
  const [busyId, setBusyId] = useState<string | null>(null);
  const canControl = user?.role === "admin";

  async function handleToggle(device: Device) {
    if (!canControl || busyId) return;
    setBusyId(device.id);
    try {
      await toggleDevice(device.id);
    } catch (e) {
      const msg = e instanceof ApiError ? e.payload?.reason || e.payload?.error : "Không thể thao tác.";
      // eslint-disable-next-line no-alert
      if (msg) console.warn(msg);
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  const devicesBySite = new Map<string, Device[]>();
  (data?.devices || []).forEach((d) => {
    const list = devicesBySite.get(d.site_id) || [];
    list.push(d);
    devicesBySite.set(d.site_id, list);
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <LinearGradient colors={["#171c2b", "#10131a"]} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetLabel}>Xin chào</Text>
              <Text style={styles.greetName}>{user?.display_name || "—"}</Text>
            </View>
            <View style={styles.pulseChip}>
              <View style={styles.pulseDot} />
              <Text style={styles.pulseText}>Đang chạy</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <KpiCard icon="power" label="Đang bật" value={data?.stats.devices_on ?? "–"} tint={colors.good} />
            <KpiCard
              icon="pulse"
              label="Độ tin cậy TB"
              value={data ? Math.round(data.stats.avg_confidence * 100) : "–"}
              suffix="%"
              tint={colors.accent}
            />
            <KpiCard icon="warning" label="Sự cố" value={data?.stats.devices_issue ?? "–"} tint={colors.warn} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {data?.sites.map((site) => (
            <RoomSection
              key={site.id}
              site={site}
              devices={devicesBySite.get(site.id) || []}
              canControl={canControl}
              busyId={busyId}
              onPressDevice={(d) => navigation.navigate("DeviceDetail", { deviceId: d.id })}
              onToggleDevice={handleToggle}
            />
          ))}

          {!canControl && (
            <View style={styles.noticeBox}>
              <Ionicons name="eye" size={14} color={colors.textFaint} />
              <Text style={styles.noticeText}>Tài khoản của bạn chỉ có thể xem trạng thái, không bật/tắt được thiết bị.</Text>
            </View>
          )}

          {data && data.devices.length === 0 && (
            <Text style={styles.empty}>Chưa có thiết bị nào ở vị trí bạn được xem.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  greetLabel: { color: colors.textFaint, fontSize: 12 },
  greetName: { color: colors.text, fontSize: 21, fontWeight: "800", marginTop: 2 },
  pulseChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.goodSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.good },
  pulseText: { color: colors.good, fontSize: 11, fontWeight: "700" },
  kpiRow: { flexDirection: "row", gap: spacing.sm },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  noticeText: { color: colors.textFaint, fontSize: 11.5, flex: 1 },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", marginTop: spacing.xxl },
});
