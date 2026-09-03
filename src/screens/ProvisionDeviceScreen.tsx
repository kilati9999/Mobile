import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getServerUrl } from "../api/client";
import { getApStatus, ProvisioningError, sendApConfig } from "../api/provisioning";
import { colors, radius, spacing, typography } from "../theme";

type Step = "intro" | "connect" | "checking" | "form" | "sending" | "done" | "error";

function StepDots({ active }: { active: number }) {
  const labels = ["Giới thiệu", "Kết nối WiFi board", "Nhập WiFi nhà", "Hoàn tất"];
  return (
    <View style={styles.dotsRow}>
      {labels.map((label, i) => (
        <View key={label} style={styles.dotWrap}>
          <View style={[styles.dot, i <= active && styles.dotActive]}>
            {i < active ? <Ionicons name="checkmark" size={11} color="#04141c" /> : <Text style={styles.dotNum}>{i + 1}</Text>}
          </View>
          {i < labels.length - 1 && <View style={[styles.dotLine, i < active && styles.dotLineActive]} />}
        </View>
      ))}
    </View>
  );
}

export default function ProvisionDeviceScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>("intro");
  const [chipId, setChipId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrlState] = useState("");

  useEffect(() => {
    getServerUrl().then(setServerUrlState);
  }, []);

  function openWifiSettings() {
    if (Platform.OS === "android") {
      Linking.sendIntent("android.settings.WIFI_SETTINGS").catch(() => Linking.openSettings());
    } else {
      Linking.openURL("App-Prefs:root=WIFI").catch(() => Linking.openSettings());
    }
  }

  async function checkApConnection() {
    setStep("checking");
    setErrorMsg(null);
    try {
      const status = await getApStatus();
      setChipId(status.chip_id);
      setStep("form");
    } catch (e) {
      setErrorMsg(e instanceof ProvisioningError ? e.message : "Không kết nối được tới board.");
      setStep("connect");
    }
  }

  async function submitConfig() {
    if (!ssid.trim()) {
      setErrorMsg("Nhập tên WiFi (SSID) của mạng nhà.");
      return;
    }
    if (!/^https?:\/\/.+/.test(serverUrl.trim())) {
      setErrorMsg("Địa chỉ máy chủ không hợp lệ.");
      return;
    }
    setStep("sending");
    setErrorMsg(null);
    try {
      await sendApConfig(ssid.trim(), password, serverUrl.trim());
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof ProvisioningError ? e.message : "Gửi cấu hình thất bại, thử lại.");
      setStep("form");
    }
  }

  const activeDotIndex = { intro: 0, connect: 1, checking: 1, form: 2, sending: 2, done: 3, error: 1 }[step];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Thêm board ESP32 mới</Text>
        <Text style={styles.subtitle}>Kết nối lần đầu qua WiFi riêng của board (SoftAP)</Text>

        <StepDots active={activeDotIndex} />

        {step === "intro" && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="wifi" size={26} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Trước khi bắt đầu</Text>
            <Text style={styles.cardText}>
              Cấp nguồn cho board ESP32 mới (chưa từng cấu hình WiFi). Board sẽ tự phát ra một mạng WiFi riêng tên
              bắt đầu bằng <Text style={styles.mono}>GestureHome-...</Text>. Nếu board đã từng cấu hình trước đó,
              giữ nút BOOT vài giây để đưa board quay lại chế độ cấu hình.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("connect")} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Bắt đầu</Text>
            </TouchableOpacity>
          </View>
        )}

        {(step === "connect" || step === "checking") && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="bluetooth" size={26} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Kết nối điện thoại vào WiFi của board</Text>
            <Text style={styles.cardText}>
              Mở Cài đặt WiFi, chọn mạng tên <Text style={styles.mono}>GestureHome-xxxxxx</Text>, kết nối vào đó
              (điện thoại có thể báo "không có Internet" - bình thường, cứ giữ kết nối). Sau đó quay lại đây.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={openWifiSettings} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={15} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Mở Cài đặt WiFi</Text>
            </TouchableOpacity>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity style={styles.primaryButton} onPress={checkApConnection} disabled={step === "checking"} activeOpacity={0.85}>
              {step === "checking" ? (
                <ActivityIndicator color="#04141c" />
              ) : (
                <Text style={styles.primaryButtonText}>Tôi đã kết nối - Kiểm tra</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {(step === "form" || step === "sending") && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={26} color={colors.good} />
            </View>
            <Text style={styles.cardTitle}>Đã thấy board</Text>
            {chipId ? (
              <View style={styles.chipIdBox}>
                <Text style={styles.chipIdLabel}>Chip ID / MAC</Text>
                <Text style={styles.chipIdVal}>{chipId}</Text>
              </View>
            ) : null}
            <Text style={styles.cardText}>Nhập thông tin WiFi nhà để board kết nối vào mạng chính:</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Tên WiFi (SSID)</Text>
              <TextInput value={ssid} onChangeText={setSsid} placeholder="Ten_Wifi_Nha" placeholderTextColor={colors.textFaint} style={styles.input} autoCapitalize="none" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Mật khẩu WiFi</Text>
              <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textFaint} style={styles.input} secureTextEntry />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Địa chỉ máy chủ (để board báo về)</Text>
              <TextInput value={serverUrl} onChangeText={setServerUrlState} placeholder="http://192.168.1.10:5050" placeholderTextColor={colors.textFaint} style={styles.input} autoCapitalize="none" />
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity style={styles.primaryButton} onPress={submitConfig} disabled={step === "sending"} activeOpacity={0.85}>
              {step === "sending" ? <ActivityIndicator color="#04141c" /> : <Text style={styles.primaryButtonText}>Gửi cấu hình cho board</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === "done" && (
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: colors.goodSoft }]}>
              <Ionicons name="checkmark-done" size={26} color={colors.good} />
            </View>
            <Text style={styles.cardTitle}>Đã gửi cấu hình!</Text>
            <Text style={styles.cardText}>
              Board đang tự khởi động lại và kết nối vào WiFi nhà (thường mất 10-30 giây). Hãy chuyển WiFi điện
              thoại về lại mạng chính, rồi vào trang Thiết bị - board mới sẽ hiện trong mục "Board đang chờ gán",
              chọn thiết bị để gán vào.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Xong, quay lại Thiết bị</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 12.5, marginTop: 4, marginBottom: spacing.lg },

  dotsRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  dotWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  dotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotNum: { color: colors.textFaint, fontSize: 11, fontWeight: "700" },
  dotLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },
  dotLineActive: { backgroundColor: colors.accent },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center" },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm, textAlign: "center" },
  cardText: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, textAlign: "center", marginBottom: spacing.lg },
  mono: { fontFamily: "monospace", color: colors.text },

  chipIdBox: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md, marginBottom: spacing.md, alignSelf: "stretch" },
  chipIdLabel: { color: colors.textFaint, fontSize: 10, textAlign: "center" },
  chipIdVal: { color: colors.accent, fontSize: 13, fontFamily: "monospace", fontWeight: "700", textAlign: "center", marginTop: 2 },

  field: { alignSelf: "stretch", marginBottom: spacing.md },
  label: { color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: "600" },
  input: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, fontSize: 14 },

  errorText: { color: colors.bad, fontSize: 12, textAlign: "center", marginBottom: spacing.md },

  primaryButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: "center", alignSelf: "stretch" },
  primaryButtonText: { color: "#04141c", fontWeight: "800", fontSize: 14 },
  secondaryButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  secondaryButtonText: { color: colors.text, fontWeight: "700", fontSize: 13 },
});
