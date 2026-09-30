/**
 * FaceEnrollScreen.tsx
 * ====================
 * Màn hình "Huấn luyện khuôn mặt tại chỗ" - đúng theo bảng quy trình đã
 * thống nhất (6 bước, ~12 frame, KHÔNG dùng thời gian - chỉ chuyển bước
 * khi đã đạt đúng góc yêu cầu). Liên tục chụp + gọi POST /pose-check
 * (main.py, dùng heuristic 5-điểm landmark trong face_engine.py) để biết
 * góc hiện tại, tự lưu frame khi đạt và tự chuyển bước - không có bộ đếm
 * ngược nào cả.
 *
 * ⚠️ Yaw/pitch từ /pose-check là ước lượng hình học từ 5 landmark, CHƯA
 * hiệu chỉnh camera thật - nếu khi test thấy chiều trái/phải bị ngược
 * (do camera trước có thể lật ảnh), chỉ cần đổi dấu điều kiện ở bước
 * "left"/"right" trong POSES bên dưới, không cần đổi gì khác.
 */
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFaceApiUrl } from "../api/client";
import { FaceApiError, faceCheckName, facePoseCheck, faceRegister } from "../api/faceApi";
import FaceLoginForm from "../components/FaceLoginForm";
import { useFaceAuth } from "../hooks/useFaceAuth";
import { colors, radius, spacing, typography } from "../theme";

const MIN_REGISTER_IMAGES = 5; // phải khớp MIN_REGISTER_IMAGES trong main.py
const NAME_CHECK_DEBOUNCE_MS = 600;
const LOOP_DELAY_MS = 150; // nghỉ giữa 2 lần chụp thử (tránh chụp liên tục quá nhanh)
const AFTER_ACCEPT_DELAY_MS = 500; // nghỉ sau khi 1 frame đạt (đỡ chụp trùng gần như y hệt)

interface PoseStep {
  key: string;
  label: string;
  framesNeeded: number;
  check: (yaw: number, pitch: number) => boolean;
  hint: (yaw: number, pitch: number, faceFound: boolean) => string;
}

// Đúng theo bảng: Nhìn thẳng(3) → Trái(2) → Phải(2) → Cúi(2) → Ngẩng(2) → Nhìn thẳng+chớp mắt(1) = 12 frame
const POSES: PoseStep[] = [
  {
    key: "front1",
    label: "Nhìn thẳng vào camera",
    framesNeeded: 3,
    check: (yaw, pitch) => Math.abs(yaw) <= 10 && Math.abs(pitch) <= 10,
    hint: (yaw, pitch, faceFound) => {
      if (!faceFound) return "Đưa mặt vào giữa khung hình";
      if (Math.abs(yaw) > 10) return "Quay mặt về chính giữa";
      if (Math.abs(pitch) > 10) return "Giữ đầu thẳng, đừng cúi/ngẩng";
      return "Đang lấy nét…";
    },
  },
  {
    key: "left",
    label: "Quay đầu nhẹ sang trái",
    framesNeeded: 2,
    check: (yaw) => yaw <= -15 && yaw >= -30,
    hint: (yaw, _pitch, faceFound) => {
      if (!faceFound) return "Đưa mặt vào giữa khung hình";
      if (yaw > -15) return "Quay thêm sang trái";
      if (yaw < -30) return "Quay lại một chút, hơi quá rồi";
      return "Giữ nguyên…";
    },
  },
  {
    key: "right",
    label: "Quay đầu nhẹ sang phải",
    framesNeeded: 2,
    check: (yaw) => yaw >= 15 && yaw <= 30,
    hint: (yaw, _pitch, faceFound) => {
      if (!faceFound) return "Đưa mặt vào giữa khung hình";
      if (yaw < 15) return "Quay thêm sang phải";
      if (yaw > 30) return "Quay lại một chút, hơi quá rồi";
      return "Giữ nguyên…";
    },
  },
  {
    key: "down",
    label: "Cúi đầu nhẹ xuống",
    framesNeeded: 2,
    check: (_yaw, pitch) => pitch >= 10 && pitch <= 20,
    hint: (_yaw, pitch, faceFound) => {
      if (!faceFound) return "Đưa mặt vào giữa khung hình";
      if (pitch < 10) return "Cúi thêm xuống";
      if (pitch > 20) return "Ngẩng lại một chút";
      return "Giữ nguyên…";
    },
  },
  {
    key: "up",
    label: "Ngẩng đầu nhẹ lên",
    framesNeeded: 2,
    check: (_yaw, pitch) => pitch <= -10 && pitch >= -20,
    hint: (_yaw, pitch, faceFound) => {
      if (!faceFound) return "Đưa mặt vào giữa khung hình";
      if (pitch > -10) return "Ngẩng thêm lên";
      if (pitch < -20) return "Cúi lại một chút";
      return "Giữ nguyên…";
    },
  },
  {
    key: "blink",
    label: "Nhìn thẳng, chớp mắt",
    framesNeeded: 1,
    check: (yaw, pitch) => Math.abs(yaw) <= 10 && Math.abs(pitch) <= 10,
    hint: (yaw, pitch, faceFound) => (!faceFound ? "Đưa mặt vào giữa khung hình" : "Nhìn thẳng rồi chớp mắt tự nhiên"),
  },
];
const TOTAL_FRAMES = POSES.reduce((s, p) => s + p.framesNeeded, 0);

type ResultMsg = { ok: boolean; text: string } | null;
type Stage = "form" | "capturing" | "review";

export default function FaceEnrollScreen() {
  const navigation = useNavigation();
  const { token, login, logout } = useFaceAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [name, setName] = useState("");
  const [nameCheck, setNameCheck] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({
    checking: false,
    available: null,
    message: null,
  });
  const [faceApiUrl, setFaceApiUrlState] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [stepIdx, setStepIdx] = useState(0);
  const [stepFrames, setStepFrames] = useState(0);
  const [collectedUris, setCollectedUris] = useState<string[]>([]);
  const [liveHint, setLiveHint] = useState("Chuẩn bị…");
  const [wantsGlassesRound, setWantsGlassesRound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<ResultMsg>(null);

  // Refs để vòng lặp chụp liên tục đọc/ghi trạng thái mới nhất ngay lập
  // tức - state React cập nhật bất đồng bộ nên không dùng trực tiếp được
  // bên trong vòng lặp while.
  const runningRef = useRef(false);
  const stepIdxRef = useRef(0);
  const stepFramesRef = useRef(0);
  const collectedRef = useRef<string[]>([]);
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFaceApiUrl().then(setFaceApiUrlState);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    };
  }, []);

  // Kiểm tra tên trùng NGAY khi gõ (debounce) - báo sớm thay vì để tới
  // lúc quay xong 12 frame mới biết bị từ chối.
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Vòng lặp chính: chụp thử -> hỏi /pose-check -> đạt góc thì lưu +
  // tăng đếm -> đủ frame thì qua bước kế -> KHÔNG có bước nào tự chuyển
  // theo thời gian, chỉ chuyển khi thật sự đạt góc.
  const runCaptureLoop = useCallback(async () => {
    runningRef.current = true;
    while (runningRef.current) {
      if (!cameraRef.current) {
        await sleep(LOOP_DELAY_MS);
        continue;
      }
      let photo;
      try {
        photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      } catch {
        await sleep(LOOP_DELAY_MS);
        continue;
      }
      if (!runningRef.current) break;
      if (!photo?.uri) {
        await sleep(LOOP_DELAY_MS);
        continue;
      }

      try {
        const pose = await facePoseCheck(photo.uri);
        if (!runningRef.current) break;

        const step = POSES[stepIdxRef.current];
        setLiveHint(step.hint(pose.yaw, pose.pitch, pose.face_found));

        if (pose.face_found && step.check(pose.yaw, pose.pitch)) {
          stepFramesRef.current += 1;
          collectedRef.current.push(photo.uri);
          setStepFrames(stepFramesRef.current);
          setCollectedUris([...collectedRef.current]);

          if (stepFramesRef.current >= step.framesNeeded) {
            const next = stepIdxRef.current + 1;
            if (next >= POSES.length) {
              runningRef.current = false;
              setStage("review");
              return;
            }
            stepIdxRef.current = next;
            stepFramesRef.current = 0;
            setStepIdx(next);
            setStepFrames(0);
          }
          await sleep(AFTER_ACCEPT_DELAY_MS);
        }
      } catch {
        // lỗi mạng tạm thời khi gọi /pose-check - bỏ qua, thử lại vòng sau
        setLiveHint("Không kết nối được Face API, đang thử lại…");
      }
      await sleep(LOOP_DELAY_MS);
    }
  }, []);

  const handleBegin = useCallback(() => {
    if (!name.trim() || nameCheck.available === false) return;
    stepIdxRef.current = 0;
    stepFramesRef.current = 0;
    collectedRef.current = [];
    setStepIdx(0);
    setStepFrames(0);
    setCollectedUris([]);
    setResultMsg(null);
    setLiveHint("Chuẩn bị…");
    setStage("capturing");
    runCaptureLoop();
  }, [name, nameCheck.available, runCaptureLoop]);

  // Quay thêm 1 lượt (đổi kính) - GIỮ nguyên frame đã có, chạy lại đúng
  // 6 bước để lấy thêm 12 frame nữa (tăng đa dạng embedding khi người
  // dùng có/không đeo kính, theo đúng gợi ý trong quy trình).
  const handleExtraRound = useCallback(() => {
    stepIdxRef.current = 0;
    stepFramesRef.current = 0;
    // KHÔNG reset collectedRef - cộng dồn vào ảnh đã chụp lượt trước
    setStepIdx(0);
    setStepFrames(0);
    setWantsGlassesRound(false);
    setResultMsg(null);
    setLiveHint("Chuẩn bị…");
    setStage("capturing");
    runCaptureLoop();
  }, [runCaptureLoop]);

  const handleCancelCapture = useCallback(() => {
    runningRef.current = false;
    setStage("form");
  }, []);

  const handleRetakeAll = useCallback(() => {
    runningRef.current = false;
    collectedRef.current = [];
    setCollectedUris([]);
    setResultMsg(null);
    setStepIdx(0);
    setStepFrames(0);
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
        handleRetakeAll();
        setSubmitting(false);
        return;
      }
      const text = e instanceof FaceApiError ? e.message : `Không kết nối được tới Face API (${faceApiUrl}). Kiểm tra lại IP/cổng trong Cài đặt.`;
      setResultMsg({ ok: false, text });
    } finally {
      setSubmitting(false);
    }
  }, [collectedUris, name, faceApiUrl, logout, handleRetakeAll]);

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
          Đã lấy đủ {collectedUris.length} frame ({POSES.length} góc) cho "{name}".
        </Text>

        {resultMsg ? <Text style={[styles.bodyText, resultMsg.ok ? styles.successText : styles.errorText]}>{resultMsg.text}</Text> : null}

        {!submitting && !(resultMsg && resultMsg.ok) && (
          <>
            {!wantsGlassesRound ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setWantsGlassesRound(true)}>
                <Text style={styles.secondaryBtnText}>Người này có đeo kính? Quay thêm 1 lượt</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.glassesBox}>
                <Text style={styles.bodyText}>
                  Đổi trạng thái đeo kính (tháo ra nếu vừa quay có kính, hoặc đeo vào nếu vừa quay không kính) rồi bấm
                  bắt đầu để quay thêm 12 frame nữa cho lượt này.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleExtraRound}>
                  <Text style={styles.primaryBtnText}>Bắt đầu quay thêm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setWantsGlassesRound(false)}>
                  <Text style={styles.secondaryBtnText}>Bỏ qua, không cần thêm</Text>
                </TouchableOpacity>
              </View>
            )}

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

  // ==================== "form" / "capturing" - camera mount xuyên suốt ====================
  const currentStep = POSES[stepIdx];
  const framesDoneBeforeStep = POSES.slice(0, stepIdx).reduce((s, p) => s + p.framesNeeded, 0);
  const totalDone = framesDoneBeforeStep + stepFrames;

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="picture" />

      {stage === "form" && (
        <View style={styles.formOverlay}>
          <SafeAreaView style={styles.formCard}>
            <Text style={styles.title}>Huấn luyện khuôn mặt tại chỗ</Text>
            <Text style={styles.subtitle}>
              Nhập tên người dùng. App sẽ tự nhận biết khi bạn đạt đúng góc mỗi bước rồi mới chuyển tiếp - không đếm
              giờ, cứ từ từ chỉnh cho đúng hướng dẫn.
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

      {stage === "capturing" && (
        <>
          <SafeAreaView edges={["top"]} style={styles.topBar}>
            <TouchableOpacity onPress={handleCancelCapture}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarText}>
              {totalDone}/{TOTAL_FRAMES} frame
            </Text>
          </SafeAreaView>

          <SafeAreaView edges={["bottom"]} style={styles.overlay}>
            <View style={styles.stepDots}>
              {POSES.map((p, i) => (
                <View key={p.key} style={[styles.stepDot, i < stepIdx && styles.stepDotDone, i === stepIdx && styles.stepDotActive]} />
              ))}
            </View>
            <Text style={styles.instructionText}>{currentStep.label}</Text>
            <View style={styles.stepProgressTrack}>
              <View style={[styles.stepProgressFill, { width: `${(stepFrames / currentStep.framesNeeded) * 100}%` }]} />
            </View>
            <Text style={styles.stepProgressLabel}>
              {stepFrames}/{currentStep.framesNeeded} frame cho góc này
            </Text>
            <Text style={styles.liveHintText}>{liveHint}</Text>
          </SafeAreaView>
        </>
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
  secondaryBtnText: { color: colors.textDim, fontSize: 13.5, fontWeight: "700", textAlign: "center" },
  glassesBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  formOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,14,0.82)", justifyContent: "center" },
  formCard: { paddingHorizontal: spacing.xl },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(8,10,14,0.55)",
  },
  topBarText: { color: colors.text, fontSize: 12.5, fontWeight: "700" },

  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: "rgba(8,10,14,0.85)",
  },
  stepDots: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  stepDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "rgba(255,255,255,0.25)" },
  stepDotActive: { backgroundColor: colors.accent, width: 22 },
  stepDotDone: { backgroundColor: colors.good },
  instructionText: { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: spacing.md },
  stepProgressTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  stepProgressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 4 },
  stepProgressLabel: { color: colors.textDim, fontSize: 11.5, marginTop: spacing.sm },
  liveHintText: { color: colors.warn, fontSize: 13.5, fontWeight: "700", marginTop: spacing.md, textAlign: "center" },
});
