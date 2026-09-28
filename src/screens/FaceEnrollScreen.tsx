/**
 * FaceEnrollScreen.tsx
 * ====================
 * Màn hình "Huấn luyện khuôn mặt tại chỗ" - hướng dẫn quay mặt qua 4 góc
 * cố định (chính diện, phải, trái, cúi xuống), MỖI GÓC có 1-2 giây đếm
 * ngược "giữ yên" để ảnh rõ nét hơn trước khi tự động chụp.
 *
 * ĐÃ BỎ cơ chế tự động phát hiện "di chuyển quá nhanh" bằng cảm biến con
 * quay hồi chuyển (gyroscope) - trên thực tế cảm biến này có độ lệch nền
 * (bias) khác nhau tuỳ từng máy, khiến nhiều máy báo lỗi ngay cả khi giữ
 * điện thoại đứng yên tuyệt đối (không có cách hiệu chỉnh đơn giản, đáng
 * tin cậy cho mọi thiết bị). Thay vào đó, dùng cách ĐƠN GIẢN VÀ DỄ DÙNG
 * HƠN: đếm ngược trực quan để người dùng TỰ giữ yên theo nhịp, tự động
 * chụp khi đếm xong - không có bước "chấm điểm đúng/sai" nào có thể chặn
 * nhầm người dùng. Nếu ảnh bị mờ thật, người dùng có thể bấm "Làm lại từ
 * đầu" ở màn xác nhận cuối cùng sau khi xem trước.
 *
 * ⚠️ Gọi POST /register của Face Auth API (main.py, cổng 8000) - KHÔNG
 * phải server thiết bị routes.py/simulator.py (cổng 5050).
 */
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authHeaders, clearToken, getToken, saveToken } from "../api/authToken";
import { getFaceApiUrl } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";

const MIN_REGISTER_IMAGES = 5; // phải khớp MIN_REGISTER_IMAGES trong main.py

const COUNTDOWN_SECONDS = 3; // đếm ngược "giữ yên" trước khi chụp mỗi góc

const POSES = [
  { key: "front", label: "Nhìn thẳng chính diện vào camera" },
  { key: "right", label: "Quay mặt sang phải" },
  { key: "left", label: "Quay mặt sang trái" },
  { key: "down", label: "Cúi đầu xuống" },
];

type ResultMsg = { ok: boolean; text: string } | null;
type Stage = "form" | "counting" | "captured" | "review";

export default function FaceEnrollScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [faceApiUrl, setFaceApiUrlState] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [poseIdx, setPoseIdx] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [collectedUris, setCollectedUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<ResultMsg>(null);

  // Token lưu sẵn trong máy (AsyncStorage): undefined = đang đọc, null = chưa có
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    getFaceApiUrl().then(setFaceApiUrlState);
    getToken().then(setToken);
  }, []);

  const handleSaveToken = useCallback(async () => {
    if (!tokenInput.trim()) {
      setTokenError("Vui lòng dán token vào ô trên.");
      return;
    }
    await saveToken(tokenInput);
    setToken(tokenInput.trim());
    setTokenInput("");
    setTokenError(null);
  }, [tokenInput]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const currentPose = POSES[poseIdx];

  const capturePose = useCallback(async () => {
    // Chụp 2 tấm liên tiếp ngay sau khi đếm xong (4 góc × 2 = 8 ảnh, đủ
    // MIN_REGISTER_IMAGES=5 của main.py với dư ra để chọn ảnh tốt hơn).
    for (let i = 0; i < 2; i++) {
      try {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, skipProcessing: true });
        if (photo?.uri) {
          setCollectedUris((prev) => [...prev, photo.uri]);
        }
      } catch {
        // bỏ qua 1 lần chụp lỗi - người dùng vẫn có thể làm lại từ đầu ở màn xác nhận nếu thiếu ảnh
      }
    }
    setStage("captured");
    timerRef.current = setTimeout(() => {
      setPoseIdx((p) => {
        const next = p + 1;
        if (next >= POSES.length) {
          setStage("review");
          return p;
        }
        setCountdown(COUNTDOWN_SECONDS);
        setStage("counting");
        return next;
      });
    }, 500);
  }, []);

  // Đếm ngược 3-2-1 rồi tự động chụp - không có bước "chấm điểm" nào có
  // thể chặn nhầm người dùng, chỉ là nhịp trực quan giúp giữ yên tự nhiên.
  useEffect(() => {
    if (stage !== "counting") return;
    if (countdown <= 0) {
      capturePose();
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage, countdown, capturePose]);

  const handleBegin = useCallback(() => {
    if (!name.trim()) return;
    setCollectedUris([]);
    setResultMsg(null);
    setPoseIdx(0);
    setCountdown(COUNTDOWN_SECONDS);
    setStage("counting");
  }, [name]);

  const handleRetakeAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCollectedUris([]);
    setResultMsg(null);
    setPoseIdx(0);
    setStage("form");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (collectedUris.length < MIN_REGISTER_IMAGES) return;
    setSubmitting(true);
    setResultMsg(null);

    const form = new FormData();
    form.append("name", name.trim());
    collectedUris.forEach((uri, idx) => {
      // @ts-expect-error - React Native FormData chấp nhận object {uri,name,type}, khác với DOM FormData chuẩn
      form.append("images", { uri, name: `face_${idx}.jpg`, type: "image/jpeg" });
    });

    try {
      const res = await fetch(`${faceApiUrl}/register`, {
        method: "POST",
        body: form,
        headers: {
          // KHÔNG tự đặt "Content-Type": "multipart/form-data" thủ công -
          // fetch/RN cần tự sinh boundary chính xác, tự đặt sẽ làm hỏng request.
          Accept: "application/json",
          ...(await authHeaders()),
        },
      });
      const data = await res.json();

      // Token sai/hết hạn -> xoá token đã lưu và quay lại màn nhập token
      if (res.status === 401) {
        await clearToken();
        setToken(null);
        setTokenError(data.detail || "Token không hợp lệ hoặc đã hết hạn - vui lòng nhập lại.");
        setCollectedUris([]);
        setPoseIdx(0);
        setStage("form");
        return;
      }

      if (res.ok && data.success) {
        setResultMsg({ ok: true, text: `Đã đăng ký "${data.name}" với ${data.num_embeddings} vector khuôn mặt.` });
      } else {
        setResultMsg({ ok: false, text: data.detail || data.message || "Đăng ký thất bại - vui lòng thử lại." });
      }
    } catch (e) {
      setResultMsg({ ok: false, text: `Không kết nối được tới Face API (${faceApiUrl}). Kiểm tra lại IP/cổng trong Cài đặt.` });
    } finally {
      setSubmitting(false);
    }
  }, [collectedUris, name, faceApiUrl]);

  // ==================== Xin quyền camera ====================
  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="camera-outline" size={32} color={colors.textFaint} style={{ marginBottom: spacing.md }} />
        <Text style={styles.bodyText}>Cần quyền truy cập camera để huấn luyện khuôn mặt.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Cấp quyền camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ==================== Chưa có token: nhập 1 lần, lưu lại dùng mãi ====================
  if (token === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (token === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Nhập token đăng nhập</Text>
        <Text style={styles.subtitle}>
          Dán token một lần duy nhất. Ứng dụng sẽ lưu lại trên máy và tự dùng cho các lần sau.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Dán token vào đây"
          placeholderTextColor={colors.textFaint}
          value={tokenInput}
          onChangeText={setTokenInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {tokenError ? <Text style={[styles.bodyText, styles.errorText]}>{tokenError}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveToken}>
          <Text style={styles.primaryBtnText}>Lưu token</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ==================== Màn hình xác nhận gửi (không cần camera nữa) ====================
  if (stage === "review") {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Xác nhận đăng ký</Text>
        <Text style={styles.subtitle}>
          Đã chụp {collectedUris.length} ảnh qua {POSES.length} góc cho "{name}".
        </Text>

        {resultMsg ? <Text style={[styles.bodyText, resultMsg.ok ? styles.successText : styles.errorText]}>{resultMsg.text}</Text> : null}

        {!submitting && !(resultMsg && resultMsg.ok) && (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, collectedUris.length < MIN_REGISTER_IMAGES && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={collectedUris.length < MIN_REGISTER_IMAGES}
            >
              <Text style={styles.primaryBtnText}>Gửi đăng ký</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRetakeAll}>
              <Text style={styles.secondaryBtnText}>Làm lại từ đầu</Text>
            </TouchableOpacity>
          </>
        )}

        {submitting ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : null}

        {resultMsg?.ok ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Xong</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  // ==================== "form" / "counting" / "captured" - camera mount xuyên suốt ====================
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="picture" />

      {stage === "form" && (
        <View style={styles.formOverlay}>
          <SafeAreaView style={styles.formCard}>
            <Text style={styles.title}>Huấn luyện khuôn mặt tại chỗ</Text>
            <Text style={styles.subtitle}>
              Nhập tên người dùng. App sẽ lần lượt yêu cầu quay mặt qua {POSES.length} góc - mỗi góc đếm ngược{" "}
              {COUNTDOWN_SECONDS} giây rồi tự động chụp, giữ điện thoại và khuôn mặt yên trong lúc đếm.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Tên người dùng"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
            />
            {!name.trim() ? <Text style={styles.hintText}>Nhập tên trước khi bắt đầu.</Text> : null}
            <Text style={styles.apiUrlText}>Face API: {faceApiUrl || "…"} (sửa ở tab Khác → Cài đặt)</Text>
            <TouchableOpacity style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]} onPress={handleBegin} disabled={!name.trim()}>
              <Text style={styles.primaryBtnText}>Bắt đầu</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      {(stage === "counting" || stage === "captured") && (
        <SafeAreaView edges={["bottom"]} style={styles.overlay}>
          <View style={styles.stepDots}>
            {POSES.map((p, i) => (
              <View key={p.key} style={[styles.stepDot, i < poseIdx && styles.stepDotDone, i === poseIdx && styles.stepDotActive]} />
            ))}
          </View>
          <Text style={styles.instructionText}>{currentPose.label}</Text>
          {stage === "counting" ? (
            <>
              <Text style={styles.countdownText}>{countdown > 0 ? countdown : "📸"}</Text>
              <Text style={styles.holdLabel}>Giữ yên…</Text>
            </>
          ) : (
            <Text style={styles.holdLabel}>Đã chụp ✓</Text>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: "center" },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { color: colors.textDim, fontSize: 13.5, marginBottom: spacing.xl, lineHeight: 20 },
  bodyText: { color: colors.textDim, fontSize: 13.5, textAlign: "center", marginTop: spacing.md },
  hintText: { color: colors.textFaint, fontSize: 11.5, marginTop: -spacing.md, marginBottom: spacing.md },
  apiUrlText: { color: colors.textFaint, fontSize: 11, fontFamily: "monospace", marginBottom: spacing.md },
  successText: { color: colors.good },
  errorText: { color: colors.bad },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.md },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: "#04141c", fontSize: 15, fontWeight: "800" },
  secondaryBtn: { borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  secondaryBtnText: { color: colors.textDim, fontSize: 15, fontWeight: "700" },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  formOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,14,0.82)", justifyContent: "center" },
  formCard: { paddingHorizontal: spacing.xl },

  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: "rgba(8,10,14,0.82)",
  },
  stepDots: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  stepDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "rgba(255,255,255,0.25)" },
  stepDotActive: { backgroundColor: colors.accent, width: 22 },
  stepDotDone: { backgroundColor: colors.good },
  instructionText: { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: spacing.md },
  countdownText: { color: colors.accent, fontSize: 48, fontWeight: "800" },
  holdLabel: { color: colors.textDim, fontSize: 13, marginTop: spacing.sm },
});
