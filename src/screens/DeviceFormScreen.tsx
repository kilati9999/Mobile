import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackRouteProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, createDevice, getAccounts, getDevices, getSites, updateDevice } from "../api/client";
import type { Account, Site } from "../api/types";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, DEVICE_TYPE_META, radius, spacing, typography } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackRouteProp<RootStackParamList, "DeviceForm">;

export default function DeviceFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const editingId = route.params?.deviceId ?? null;
  const isEdit = !!editingId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>(Object.keys(DEVICE_TYPE_META)[0] || "switch");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [assignedUser, setAssignedUser] = useState<string | null>(null);
  const [mac, setMac] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [siteList, accountList] = await Promise.all([getSites(), getAccounts()]);
        setSites(siteList);
        setAccounts(accountList);
        if (!siteId && siteList[0]) setSiteId(siteList[0].id);

        if (isEdit && editingId) {
          const devices = await getDevices();
          const dev = devices.find((d) => d.id === editingId);
          if (dev) {
            setName(dev.name);
            setType(dev.type);
            setSiteId(dev.site_id);
            setAssignedUser(dev.assigned_user);
            setMac(dev.mac || "");
          }
        }
      } catch (e) {
        setErrorMsg("Không tải được dữ liệu, thử lại.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit() {
    if (!name.trim()) {
      setErrorMsg("Nhập tên thiết bị.");
      return;
    }
    if (!siteId) {
      setErrorMsg("Chọn vị trí lắp đặt.");
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      if (isEdit && editingId) {
        await updateDevice(editingId, { name: name.trim(), type, site_id: siteId, assigned_user: assignedUser, mac });
      } else {
        await createDevice({ name: name.trim(), type, site_id: siteId, assigned_user: assignedUser, mac: mac || null });
      }
      navigation.goBack();
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.payload?.error || e.message : "Không thể lưu, thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorText}>Chỉ quản trị viên mới có thể thêm/sửa thiết bị.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{isEdit ? "Sửa thiết bị" : "Thêm thiết bị mới"}</Text>

        <Text style={styles.label}>Tên thiết bị</Text>
        <TextInput value={name} onChangeText={setName} placeholder="VD: Đèn ban công" placeholderTextColor={colors.textFaint} style={styles.input} />

        <Text style={styles.label}>Loại thiết bị</Text>
        <View style={styles.chipsRow}>
          {Object.entries(DEVICE_TYPE_META).map(([id, meta]) => (
            <TouchableOpacity key={id} onPress={() => setType(id)} style={[styles.chip, type === id && styles.chipActive]}>
              <Text style={[styles.chipText, type === id && styles.chipTextActive]}>{meta.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Vị trí lắp đặt</Text>
        <View style={styles.chipsRow}>
          {sites.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => setSiteId(s.id)} style={[styles.chip, siteId === s.id && styles.chipActive]}>
              <Text style={[styles.chipText, siteId === s.id && styles.chipTextActive]} numberOfLines={1}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Người phụ trách</Text>
        <View style={styles.chipsRow}>
          <TouchableOpacity onPress={() => setAssignedUser(null)} style={[styles.chip, !assignedUser && styles.chipActive]}>
            <Text style={[styles.chipText, !assignedUser && styles.chipTextActive]}>Chưa gán</Text>
          </TouchableOpacity>
          {accounts.map((a) => (
            <TouchableOpacity key={a.username} onPress={() => setAssignedUser(a.username)} style={[styles.chip, assignedUser === a.username && styles.chipActive]}>
              <Text style={[styles.chipText, assignedUser === a.username && styles.chipTextActive]} numberOfLines={1}>
                {a.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Chip ID board ESP32 (tuỳ chọn)</Text>
        <TextInput
          value={mac}
          onChangeText={setMac}
          placeholder="3C71BFA12345 - để trống nếu chưa có board"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          Lấy đúng giá trị "Chip ID" board in ra Serial Monitor lúc khởi động (12 ký tự hex) - KHÔNG phải địa chỉ MAC
          WiFi có dấu hai chấm.{isEdit ? " Đổi giá trị này sẽ yêu cầu board ghép nối lại từ đầu." : ""}
        </Text>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#04141c" /> : <Text style={styles.submitBtnText}>{isEdit ? "Lưu thay đổi" : "Thêm thiết bị"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.textDim, fontSize: 12, fontWeight: "600", marginBottom: 8, marginTop: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: 200 },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.text },
  hint: { color: colors.textFaint, fontSize: 11, marginTop: 6, lineHeight: 16 },
  errorText: { color: colors.bad, fontSize: 12.5, marginTop: spacing.md, textAlign: "center" },
  submitBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.xl },
  submitBtnText: { color: "#04141c", fontWeight: "800", fontSize: 14.5 },
});
