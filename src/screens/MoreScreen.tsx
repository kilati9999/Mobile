import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function MenuRow({ icon, label, sub, onPress, danger }: { icon: any; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.badSoft }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.bad : colors.textDim} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && { color: colors.bad }]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />}
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Khác</Text>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name || "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.accName}>{user?.display_name}</Text>
          <Text style={styles.accRole}>{user?.role === "admin" ? "Quản trị · tất cả vị trí" : "Chỉ xem vị trí được gán"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <MenuRow icon="time" label="Nhật ký" sub="Lệnh cử chỉ & cảnh báo cháy" onPress={() => navigation.navigate("Logs")} />
        <MenuRow icon="settings" label="Cài đặt" sub="Địa chỉ máy chủ" onPress={() => navigation.navigate("Settings")} />
      </View>

      <View style={styles.section}>
        <MenuRow icon="log-out" label="Đăng xuất" danger onPress={logout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#04141c", fontSize: 18, fontWeight: "800" },
  accName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  accRole: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  section: { marginHorizontal: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowLabel: { color: colors.text, fontSize: 13.5, fontWeight: "600" },
  rowSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
});
