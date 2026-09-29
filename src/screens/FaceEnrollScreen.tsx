/**
 * FaceEnrollScreen.tsx
 * ====================
 * Màn hình "Huấn luyện khuôn mặt tại chỗ" - hướng dẫn quay mặt qua 4 góc
 * cố định (chính diện, phải, trái, cúi xuống), MỖI GÓC có đếm ngược "giữ
 * yên" trước khi tự động chụp. Đăng nhập bằng ĐÚNG tài khoản/mật khẩu hệ
 * thống (không dán token thủ công) - xem useFaceAuth()/faceApi.ts.
 *
 * ⚠️ Gọi POST /register của Face Auth API (main.py, cổng riêng - xem Cài
 * đặt) - KHÔNG phải server thiết bị routes.py/simulator.py.
 */
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FaceApiError, faceCheckName, faceRegister } from "../api/faceApi";
import FaceLoginForm from "../components/FaceLoginForm";
import { useFaceAuth } from "../hooks/useFaceAuth";
import { getFaceApiUrl } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";

const MIN_REGISTER_IMAGES = 5; // phải khớp MIN_REGISTER_IMAGES trong main.py
const COUNTDOWN_SECONDS = 3; // đếm ngược "giữ yên" trước khi chụp mỗi góc
const NAME_CHECK_DEBOUNCE_MS = 600;

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
  const { token, login, logout } = useFaceAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [nameCheck, setNameCheck] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({
    checking: false,
    available: null,
    message: null,
  });
  const [faceApiUrl, setFaceApiUrlState] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [poseIdx, setPoseIdx] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [collectedUris, setCollectedUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<ResultMsg>(null);

  useEffect(() => {
    getFaceApiUrl().then(setFaceApiUrlState);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    };
  }, []);

  // Kiểm tra tên trùng NGAY khi người dùng gõ (debounce 600ms) - báo sớm
  // thay vì để tới lúc quay xong 4 góc mới biết bị từ chối.
  useEffect(() => {
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    if (!name.trim() || token == null) {
      setNameCheck({ checking: false, available: null, message: null });
      return;
    }
    nameCheckTimerRef.current = setTimeout(async () => {
      setNameCheck((s) => ({ ...s, checking: true }));
      try {
        const result = await faceCheckName(name.trim());
        setNameCheck({ checking: false, available: result.available, message: result.message });
      } catch {
        setNameCheck({ checking: false, available: null, message: null });
      }
    }, NAME_CHECK_DEBOUNCE_MS);
  }, [name, token]);

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
    if (!name.trim() || nameCheck.available === false) return;
    setCollectedUris([]);
    setResultMsg(null);
    setPoseIdx(0);
    setCountdown(COUNTDOWN_SECONDS);
    setStage("counting");
  }, [name, nameCheck.available]);

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
    try {
      const data = await faceRegister(name.trim(), collectedUris);
      setResultMsg({ ok: true, text: `Đã đăng ký "${data.name}" với ${data.num_embeddings} vector khuôn mặt.` });
    } catch (e) {
      if (e instanceof FaceApiError && e.status === 401) {
        await logout();
        setCollectedUris([]);
        setPoseIdx(0);
        setStage("form");
        setSubmitting(false);
        return;
      }
      const text = e instanceof FaceApiError ? e.message : `Không kết nối được tới Face API (${faceApiUrl}). Kiểm tra lại IP/cổng trong Cài đặt.`;
      setResultMsg({ ok: false, text });
    } finally {
      setSubmitting(false);
    }
  }, [collectedUris, name, faceApiUrl, logout]);

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

  // ==================== Chưa đăng nhập Face API ====================
  if (token === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (token === null) {
    return <FaceLoginForm onSubmit={login} />;
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
            {nameCheck.checking ? <Text style={styles.hintText}>Đang kiểm tra tên…</Text> : null}
            {!nameCheck.checking && nameCheck.message ? (
              <Text style={[styles.hintText, nameCheck.available === false && styles.errorText]}>{nameCheck.message}</Text>
            ) : null}
            <Text style={styles.apiUrlText}>Face API: {faceApiUrl || "…"} (sửa ở tab Khác → Cài đặt)</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!name.trim() || nameCheck.available === false) && styles.primaryBtnDisabled]}
              onPress={handleBegin}
              disabled={!name.trim() || nameCheck.available === false}
            >
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
