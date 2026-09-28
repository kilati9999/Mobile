import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getDevices, getSites, toggleDevice } from "../api/client";
import type { Device } from "../api/types";
import DeviceCard from "../components/DeviceCard";
import SensorSection from "../components/SensorSection";
import { usePolling } from "../hooks/usePolling";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DevicesScreen() {
  const navigation = useNavigation<Nav>();
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    const [sites, devices] = await Promise.all([getSites(), getDevices(selectedSite)]);
    return { sites, devices };
  }, [selectedSite]);

  const { data, refresh } = usePolling(fetcher, 2000);

  // Chỉ hiện thiết bị đã ghép nối ESP32 thật (đã gán Chip ID) trong danh
  // sách chính - không còn thiết bị mô phỏng/chưa cấu hình lẫn vào đây.
  const connectedDevices = useMemo(() => (data?.devices || []).filter((d) => !!d.mac), [data]);

  const chips = useMemo(() => {
    const all = { id: null as string | null, name: "Tất cả", count: data?.sites.reduce((a, s) => a + s.device_count, 0) || 0 };
    const siteChips = (data?.sites || []).map((s) => ({ id: s.id, name: s.name, count: s.device_count, outage: s.network_outage }));
    return [all, ...siteChips];
  }, [data]);

  async function handleToggle(device: Device) {
    if (busyId) return;
    setBusyId(device.id);
    try {
      await toggleDevice(device.id);
    } catch (e) {
      if (e instanceof ApiError) console.warn(e.payload?.reason || e.message);
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={connectedDevices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerTextCol}>
                <Text style={styles.title}>Thiết bị &amp; ESP32</Text>
                <Text style={styles.subtitle}>Toàn bộ thiết bị, cảm biến và board ESP32 điều khiển</Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity style={styles.addButtonOutline} onPress={() => navigation.navigate("DeviceForm")} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("ProvisionDevice")} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color="#04141c" />
                  <Text style={styles.addButtonText}>Board mới</Text>
                </TouchableOpacity>
              </View>
            </View>

            <SensorSection />

            <Text style={styles.listSectionTitle}>Danh sách thiết bị</Text>
            <FlatList
              horizontal
              data={chips}
              keyExtractor={(c) => c.id || "all"}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedSite(item.id)}
                  style={[styles.chip, selectedSite === item.id && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  {"outage" in item && item.outage ? <View style={styles.chipOutageDot} /> : null}
                  <Text style={[styles.chipText, selectedSite === item.id && styles.chipTextActive]}>
                    {item.name} · {item.count}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>Chưa có thiết bị nào đã ghép nối ESP32 ở vị trí này - bấm "Board mới" hoặc "+" để thêm.</Text>}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            variant="row"
            canControl
            busy={busyId === item.id}
            onPress={() => navigation.navigate("DeviceDetail", { deviceId: item.id })}
            onToggle={() => handleToggle(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  headerTextCol: { flex: 1 },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  addButtonOutline: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  addButtonText: { color: "#04141c", fontSize: 12, fontWeight: "800" },
  chipRow: { gap: spacing.sm, paddingBottom: spacing.md },
  listSectionTitle: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipOutageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bad },
  chipText: { color: colors.textDim, fontSize: 12.5, fontWeight: "600" },
  chipTextActive: { color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.xxl },
});
