import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getState } from "../api/client";
import type { HistoryEntry } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { usePolling } from "../hooks/usePolling";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Khối này thay cho 2 thẻ "Tay trái"/"Tay phải" trước đây - đăng ký
 * khuôn mặt người dùng mới ngay tại đây (chụp 5 ảnh qua camera điện
 * thoại), đồng bộ với hệ thống xác thực cửa (door_access.py). Chỉ admin
 * mới thực hiện được (thao tác nhạy cảm, ảnh hưởng quyền ra vào thật).
 */
function FaceEnrollPanel() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const canEnroll = user?.role === "admin";

  return (
    <View style={styles.enrollCard}>
      <View style={styles.enrollIconWrap}>
        <Ionicons name="person-add" size={26} color={colors.accent} />
      </View>
      <Text style={styles.enrollTitle}>Huấn luyện khuôn mặt tại chỗ</Text>
      <Text style={styles.enrollDesc}>
        Chụp 5 ảnh khuôn mặt theo hướng dẫn để đăng ký người dùng mới, đồng bộ với hệ thống xác thực cửa.
      </Text>
      {canEnroll ? (
        <TouchableOpacity style={styles.enrollBtn} onPress={() => navigation.navigate("FaceEnroll")} activeOpacity={0.85}>
          <Text style={styles.enrollBtnText}>Bắt đầu</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.comingSoonChip}>
          <Text style={styles.comingSoonText}>Chỉ admin mới đăng ký được</Text>
        </View>
      )}
    </View>
  );
}

function FeedItem({ entry }: { entry: HistoryEntry }) {
  return (
    <View style={[styles.feedItem, !entry.applied && styles.feedItemBlocked]}>
      <View style={styles.feedTop}>
        <Text style={styles.feedTime}>{entry.time}</Text>
        <Text style={styles.feedHand}>{entry.hand || "Cửa"}</Text>
      </View>
      <Text style={styles.feedMain}>
        {entry.gesture ? `${entry.gesture} → ` : ""}
        {entry.action} · <Text style={{ fontWeight: "700" }}>{entry.device}</Text>
      </Text>
      {entry.note ? <Text style={styles.feedNote}>{entry.note}</Text> : null}
    </View>
  );
}

export default function LiveScreen() {
  const { data } = usePolling(getState, 900);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Trực tiếp</Text>
        <Text style={styles.subtitle}>Nhật ký hành động và huấn luyện tại chỗ</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FaceEnrollPanel />

        <View style={styles.sectionHead}>
          <Ionicons name="time" size={13} color={colors.textFaint} />
          <Text style={styles.sectionTitle}>Nhật ký gần đây</Text>
        </View>
        {(data?.history || []).length === 0 && <Text style={styles.empty}>Chưa có lệnh nào được xác nhận…</Text>}
        {(data?.history || []).map((h) => (
          <FeedItem key={h.id} entry={h} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  enrollCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  enrollIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  enrollTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm, textAlign: "center" },
  enrollDesc: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, textAlign: "center", marginBottom: spacing.md },
  comingSoonChip: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  comingSoonText: { color: colors.textFaint, fontSize: 11, fontWeight: "700" },
  enrollBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 24, paddingVertical: 11 },
  enrollBtnText: { color: "#04141c", fontSize: 13, fontWeight: "800" },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: spacing.xl },

  feedItem: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.good },
  feedItemBlocked: { borderLeftColor: colors.bad, opacity: 0.75 },
  feedTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  feedTime: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  feedHand: { color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" },
  feedMain: { color: colors.text, fontSize: 12.5 },
  feedNote: { color: colors.bad, fontSize: 11, marginTop: 3 },
});
