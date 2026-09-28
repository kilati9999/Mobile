import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { assignPendingBoard, createDevice, discardPendingBoard, getDevices, getPendingBoards, getSites } from "../api/client";
import type { Device, PendingBoard, Site } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { colors, DEVICE_TYPE_META, radius, spacing, typography } from "../theme";

function openWifiSettings() {
  if (Platform.OS === "android") {
    Linking.sendIntent("android.settings.WIFI_SETTINGS").catch(() => Linking.openSettings());
  } else {
    Linking.openURL("App-Prefs:root=WIFI").catch(() => Linking.openSettings());
  }
}

function InfoCard({ icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function PendingRow({
  board,
  devices,
  sites,
  onAssigned,
}: {
  board: PendingBoard;
  devices: Device[];
  sites: Site[];
  onAssigned: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(devices.length > 0 ? "existing" : "new");
  const [selectedDevice, setSelectedDevice] = useState<string | null>(devices[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>(Object.keys(DEVICE_TYPE_META)[0] || "switch");
  const [newSite, setNewSite] = useState<string | null>(sites[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onAssign() {
    if (!selectedDevice) return;
    setBusy(true);
    try {
      await assignPendingBoard(board.chip_id, selectedDevice);
      onAssigned();
    } catch (e) {
      // im lặng - danh sách sẽ tự làm mới ở vòng poll sau
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAndAssign() {
    if (!newName.trim()) {
      setErrorMsg("Đặt tên cho thiết bị mới.");
      return;
    }
    if (!newSite) {
      setErrorMsg("Chọn vị trí lắp đặt.");
      return;
    }
    setErrorMsg(null);
    setBusy(true);
    try {
      // create_device() đã tự bỏ board này khỏi danh sách chờ gán khi mac
      // khớp - không cần gọi assign() thêm.
      await createDevice({ name: newName.trim(), type: newType, site_id: newSite, mac: board.chip_id });
      onAssigned();
    } catch (e: any) {
      setErrorMsg(e?.message || "Không thể tạo thiết bị, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard() {
    setBusy(true);
    try {
      await discardPendingBoard(board.chip_id);
      onAssigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.pendingRow}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingChip}>{board.chip_id}</Text>
        <Text style={styles.pendingSub}>
          IP {board.ip || "—"} · thấy lần cuối {board.last_seen}
        </Text>
      </View>

      <View style={styles.modeTabs}>
        {devices.length > 0 && (
          <TouchableOpacity style={[styles.modeTab, mode === "existing" && styles.modeTabActive]} onPress={() => setMode("existing")}>
            <Text style={[styles.modeTabText, mode === "existing" && styles.modeTabTextActive]}>Gán vào thiết bị có sẵn</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.modeTab, mode === "new" && styles.modeTabActive]} onPress={() => setMode("new")}>
          <Text style={[styles.modeTabText, mode === "new" && styles.modeTabTextActive]}>+ Tạo thiết bị mới</Text>
        </TouchableOpacity>
      </View>

      {mode === "existing" && devices.length > 0 ? (
        <View style={styles.deviceChipsRow}>
          {devices.map((d) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => setSelectedDevice(d.id)}
              style={[styles.deviceChip, selectedDevice === d.id && styles.deviceChipActive]}
            >
              <Text style={[styles.deviceChipText, selectedDevice === d.id && styles.deviceChipTextActive]} numberOfLines={1}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.newDeviceForm}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Tên thiết bị mới, VD: Đèn ban công"
            placeholderTextColor={colors.textFaint}
            style={styles.newDeviceInput}
          />
          <Text style={styles.pendingLabel}>Loại thiết bị</Text>
          <View style={styles.deviceChipsRow}>
            {Object.entries(DEVICE_TYPE_META).map(([id, meta]) => (
              <TouchableOpacity key={id} onPress={() => setNewType(id)} style={[styles.deviceChip, newType === id && styles.deviceChipActive]}>
                <Text style={[styles.deviceChipText, newType === id && styles.deviceChipTextActive]}>{meta.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sites.length > 0 && (
            <>
              <Text style={styles.pendingLabel}>Vị trí lắp đặt</Text>
              <View style={styles.deviceChipsRow}>
                {sites.map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => setNewSite(s.id)} style={[styles.deviceChip, newSite === s.id && styles.deviceChipActive]}>
                    <Text style={[styles.deviceChipText, newSite === s.id && styles.deviceChipTextActive]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <View style={styles.pendingActions}>
        <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} disabled={busy}>
          <Text style={styles.discardBtnText}>Bỏ qua</Text>
        </TouchableOpacity>
        {mode === "existing" ? (
          <TouchableOpacity style={styles.assignBtn} onPress={onAssign} disabled={busy || !selectedDevice}>
            {busy ? <ActivityIndicator size="small" color="#04141c" /> : <Text style={styles.assignBtnText}>Gán vào thiết bị</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.assignBtn} onPress={onCreateAndAssign} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#04141c" /> : <Text style={styles.assignBtnText}>Tạo thiết bị</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ProvisionDeviceScreen() {
  const fetcher = useCallback(async () => {
    const [pending, devices, sites] = await Promise.all([getPendingBoards(), getDevices(), getSites()]);
    return { pending, devices, sites };
  }, []);
  const { data, refresh } = usePolling(fetcher, 2500);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Thêm board ESP32 mới</Text>
        <Text style={styles.subtitle}>Board dùng WiFiManager để tự phát WiFi cấu hình lần đầu</Text>

        <InfoCard icon="flash" title="1. Cấp nguồn board mới">
          <Text style={styles.cardText}>
            Board ESP32 chưa từng cấu hình WiFi sẽ tự phát ra mạng tên{" "}
            <Text style={styles.mono}>ESP32-Config-XXXX</Text> (4 ký tự cuối theo Chip ID mỗi board), mật khẩu{" "}
            <Text style={styles.mono}>12345678</Text>. Nếu board đã từng cấu hình trước đó và muốn đổi WiFi khác,
            giữ nút <Text style={styles.mono}>BOOT</Text> hơn 5 giây để xoá WiFi cũ và board tự khởi động lại vào
            chế độ phát WiFi.
          </Text>
        </InfoCard>

        <InfoCard icon="wifi" title="2. Kết nối điện thoại vào WiFi của board">
          <Text style={styles.cardText}>
            Mở Cài đặt WiFi, chọn mạng <Text style={styles.mono}>ESP32-Config-XXXX</Text>, nhập mật khẩu{" "}
            <Text style={styles.mono}>12345678</Text>. Điện thoại có thể tự bật thông báo "Đăng nhập vào mạng" -
            bấm vào đó; nếu không thấy, tự mở trình duyệt và vào địa chỉ{" "}
            <Text style={styles.mono}>http://192.168.4.1</Text>.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={openWifiSettings} activeOpacity={0.8}>
            <Ionicons name="open-outline" size={15} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Mở Cài đặt WiFi</Text>
          </TouchableOpacity>
        </InfoCard>

        <InfoCard icon="key" title="3. Chọn WiFi nhà ngay trên trang hiện ra">
          <Text style={styles.cardText}>
            Trang cấu hình (do board tự hiện ra, không phải màn hình trong app này) sẽ cho chọn tên WiFi nhà và
            nhập mật khẩu. Sau khi gửi, board tự kết nối vào WiFi đó và tự báo về máy chủ - không cần thao tác gì
            thêm trong app.
          </Text>
        </InfoCard>

        <InfoCard icon="checkmark-done" title="4. Chuyển điện thoại về lại WiFi nhà và chờ board xuất hiện">
          <Text style={styles.cardText}>
            Board báo về máy chủ sau vài giây. Nếu Chip ID của board chưa được gán sẵn cho thiết bị nào, nó sẽ hiện
            ở danh sách "Board đang chờ gán" bên dưới - chọn thiết bị để gán.
          </Text>

          {(data?.pending || []).length === 0 ? (
            <Text style={styles.emptyPending}>Chưa thấy board nào chờ gán…</Text>
          ) : (
            (data?.pending || []).map((b) => (
              <PendingRow key={b.chip_id} board={b} devices={data?.devices || []} sites={data?.sites || []} onAssigned={refresh} />
            ))
          )}
        </InfoCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4, marginBottom: spacing.lg },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  iconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.text, fontSize: 13.5, fontWeight: "700", flex: 1 },
  cardText: { color: colors.textDim, fontSize: 12.5, lineHeight: 19 },
  mono: { fontFamily: "monospace", color: colors.text },

  secondaryButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.md, marginTop: spacing.md },
  secondaryButtonText: { color: colors.text, fontWeight: "700", fontSize: 12.5 },

  emptyPending: { color: colors.textFaint, fontSize: 12.5, textAlign: "center", paddingVertical: spacing.md },

  pendingRow: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: "rgba(251,191,36,0.3)", padding: spacing.md, marginTop: spacing.sm },
  pendingInfo: { marginBottom: spacing.sm },
  pendingChip: { color: colors.warn, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  pendingSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  pendingLabel: { color: colors.textDim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  deviceChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  modeTabs: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  modeTab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  modeTabActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeTabText: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  modeTabTextActive: { color: colors.text },
  newDeviceForm: { marginBottom: spacing.sm },
  newDeviceInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.bad, fontSize: 11.5, marginBottom: spacing.sm },
  deviceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: 160 },
  deviceChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  deviceChipText: { color: colors.textDim, fontSize: 11.5, fontWeight: "600" },
  deviceChipTextActive: { color: colors.text },
  pendingActions: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  discardBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  discardBtnText: { color: colors.textDim, fontWeight: "700", fontSize: 12 },
  assignBtn: { flex: 2, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  assignBtnText: { color: "#04141c", fontWeight: "800", fontSize: 12 },
});
