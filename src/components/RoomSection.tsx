import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Device, Site } from "../api/types";
import { colors, spacing } from "../theme";
import DeviceCard from "./DeviceCard";

interface Props {
  site: Site;
  devices: Device[];
  canControl: boolean;
  busyId: string | null;
  onPressDevice: (d: Device) => void;
  onToggleDevice: (d: Device) => void;
}

export default function RoomSection({ site, devices, canControl, busyId, onPressDevice, onToggleDevice }: Props) {
  if (!devices.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="location" size={13} color={colors.textFaint} />
          <Text style={styles.title}>{site.name}</Text>
        </View>
        {site.network_outage ? (
          <View style={styles.outageChip}>
            <Ionicons name="cloud-offline" size={11} color={colors.bad} />
            <Text style={styles.outageText}>Mất mạng cả khu</Text>
          </View>
        ) : (
          <Text style={styles.onlineCount}>
            {devices.filter((d) => d.online).length}/{devices.length} online
          </Text>
        )}
      </View>
      <View style={styles.grid}>
        {devices.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            canControl={canControl}
            busy={busyId === d.id}
            onPress={() => onPressDevice(d)}
            onToggle={() => onToggleDevice(d)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm, paddingHorizontal: 2 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "700" },
  onlineCount: { color: colors.textFaint, fontSize: 11, fontFamily: "monospace" },
  outageChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.badSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  outageText: { color: colors.bad, fontSize: 10.5, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
