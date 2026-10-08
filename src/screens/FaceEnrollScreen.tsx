/**
 * FaceEnrollScreen.tsx
 * ====================
 * "Huấn luyện khuôn mặt tại chỗ" - QUAY VIDEO THẬT (không còn chụp ảnh liên tục).
 *
 * Cách hoạt động:
 *  1. Camera (react-native-vision-camera) QUAY MỘT VIDEO LIÊN TỤC suốt quá trình.
 *  2. Đồng thời, frame processor chạy ML Kit trên từng khung hình đang quay để biết
 *     góc mặt (yaw/pitch) theo thời gian thực -> chỉ chuyển sang góc kế khi người dùng
 *     đã đạt đúng góc (KHÔNG dùng đếm giờ), và phải giữ yên ~2 khung hình liên tiếp.
 *  3. Mỗi lần đạt góc, app ghi lại "mốc thời gian" trong video.
 *  4. Quay xong -> trích đúng các khung hình tại mốc đó từ file video
 *     (expo-video-thumbnails), kiểm tra lại bằng ML Kit rằng khung hình vẫn đúng góc,
 *     rồi gửi như ảnh tới /register (API Pi giữ nguyên, không cần sửa main.py).
 *
 * Cặp trái/phải và cúi/ngẩng: hai bước trong cặp phải ở HAI PHÍA ĐỐI NGHỊCH nhau.
 * App không phụ thuộc quy ước dấu của ML Kit (khác nhau giữa camera trước/sau) -
 * người dùng quay về phía nào trước thì phía còn lại sẽ là bước sau.
 */
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import type { Camera as VisionCameraRef } from "react-native-vision-camera";
import type { VideoFile } from "react-native-vision-camera";
import { RNMLKitFaceDetector } from "@infinitered/react-native-mlkit-face-detection";
import { Camera } from "react-native-vision-camera-face-detector";
import type { Face, FaceDetectionOptions } from "react-native-vision-camera-face-detector";
import { getFaceApiUrl } from "../api/client";
import { FaceApiError, faceCheckName, faceRegister } from "../api/faceApi";
import FaceLoginForm from "../components/FaceLoginForm";
import { useFaceAuth } from "../hooks/useFaceAuth";
import { colors, radius, spacing, typography } from "../theme";

const MIN_REGISTER_IMAGES = 5; // phải khớp MIN_REGISTER_IMAGES trong main.py
const NAME_CHECK_DEBOUNCE_MS = 600;
const STABLE_FRAMES_REQUIRED = 2; // phải đạt góc + giữ yên liên tiếp N lần phân tích
const STEADY_DELTA_DEG = 6; // thay đổi góc giữa 2 lần phân tích nhỏ hơn mức này mới coi là "giữ yên"
const MIN_GAP_BETWEEN_ACCEPTS_MS = 450; // tránh lấy 2 khung gần như trùng nhau
const BLINK_FALLBACK_MS = 8000; // nếu không bắt được chớp mắt sau ngần này thì chấp nhận ảnh nhìn thẳng
const EXTRACT_TOLERANCE_DEG = 8; // sai lệch góc cho phép giữa lúc quay và khung hình trích ra
const EXTRACT_TIME_OFFSETS_MS = [0, -120, 120, -250, 250, -400]; // thử lệch quanh mốc để bù độ trễ

type Pose = { yaw: number; pitch: number };
type Signs = { yaw: number; pitch: number }; // dấu của bước đầu trong cặp (0 = chưa có)
type Mark = { t: number; yaw: number; pitch: number; step: string };

interface PoseStep {
  key: string;
  label: string;
  framesNeeded: number;
  /** "yaw"/"pitch": bước thuộc cặp đối nghịch; "none": nhìn thẳng. */
  axis: "yaw" | "pitch" | "none";
  /** "first" = bước đầu của cặp, "second" = bước sau (phải ngược phía bước đầu). */
  pairRole: "first" | "second" | "none";
  words: { more: string; less: string };
}

// Nhìn thẳng(3) → Trái(2) → Phải(2) → Cúi(2) → Ngẩng(2) → Nhìn thẳng+chớp mắt(1) = 12 khung hình
const POSES: PoseStep[] = [
  { key: "front1", label: "Nhìn thẳng vào camera", framesNeeded: 3, axis: "none", pairRole: "none", words: { more: "", less: "" } },
  { key: "left", label: "Quay đầu nhẹ sang trái", framesNeeded: 2, axis: "yaw", pairRole: "first", words: { more: "Quay thêm sang trái", less: "Quay lại một chút, hơi quá rồi" } },
  { key: "right", label: "Quay đầu nhẹ sang phải", framesNeeded: 2, axis: "yaw", pairRole: "second", words: { more: "Quay thêm sang phải", less: "Quay lại một chút, hơi quá rồi" } },
  { key: "down", label: "Cúi đầu nhẹ xuống", framesNeeded: 2, axis: "pitch", pairRole: "first", words: { more: "Cúi thêm xuống", less: "Ngẩng lại một chút" } },
  { key: "up", label: "Ngẩng đầu nhẹ lên", framesNeeded: 2, axis: "pitch", pairRole: "second", words: { more: "Ngẩng thêm lên", less: "Cúi lại một chút" } },
  { key: "blink", label: "Nhìn thẳng, chớp mắt", framesNeeded: 1, axis: "none", pairRole: "none", words: { more: "", less: "" } },
];
const TOTAL_FRAMES = POSES.reduce((s, p) => s + p.framesNeeded, 0);

const YAW_RANGE: [number, number] = [15, 30];
const PITCH_RANGE: [number, number] = [10, 20];

/** Đánh giá góc hiện tại so với yêu cầu của bước. */
function evaluate(step: PoseStep, pose: Pose, signs: Signs): { ok: boolean; hint: string } {
  const { yaw, pitch } = pose;
  if (step.axis === "none") {
    if (Math.abs(yaw) > 10) return { ok: false, hint: "Quay mặt về chính giữa" };
    if (Math.abs(pitch) > 10) return { ok: false, hint: "Giữ đầu thẳng, đừng cúi/ngẩng" };
    return { ok: true, hint: step.key === "blink" ? "Nhìn thẳng rồi chớp mắt tự nhiên" : "Giữ yên…" };
  }
  const value = step.axis === "yaw" ? yaw : pitch;
  const [lo, hi] = step.axis === "yaw" ? YAW_RANGE : PITCH_RANGE;
  const other = step.axis === "yaw" ? pitch : yaw;
  if (Math.abs(other) > 15) return { ok: false, hint: step.axis === "yaw" ? "Giữ đầu thẳng, đừng cúi/ngẩng" : "Giữ mặt hướng thẳng, đừng quay ngang" };
  const sign = Math.sign(value);
  if (step.pairRole === "second") {
    const first = step.axis === "yaw" ? signs.yaw : signs.pitch;
    if (first !== 0 && sign === first && Math.abs(value) >= lo) return { ok: false, hint: "Quay/nghiêng sang phía ngược lại" };
  }
  if (Math.abs(value) < lo) return { ok: false, hint: step.words.more };
  if (Math.abs(value) > hi) return { ok: false, hint: step.words.less };
  return { ok: true, hint: "Giữ nguyên…" };
}

function biggestFace(faces: Face[] | undefined | null): Face | null {
  if (!faces || faces.length === 0) return null;
  return faces.reduce((a, b) => (a.bounds.width * a.bounds.height >= b.bounds.width * b.bounds.height ? a : b));
}

type ResultMsg = { ok: boolean; text: string } | null;
type Stage = "form" | "starting" | "capturing" | "processing" | "review";

// Phải là object ổn định (useRef bên dưới) để plugin không bị khởi tạo lại mỗi lần render.
const DETECTOR_OPTIONS: FaceDetectionOptions = {
  performanceMode: "fast",
  classificationMode: "all", // để biết mắt mở/nhắm (bước chớp mắt)
  cameraFacing: "front",
  minFaceSize: 0.25,
};

function FaceEnrollScreenInner() {
  const navigation = useNavigation();
  const { token, login, logout } = useFaceAuth();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const cameraRef = useRef<VisionCameraRef>(null);

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
  const [processingText, setProcessingText] = useState("Đang xử lý video…");

  // Refs: logic trong frame callback cần đọc giá trị MỚI NHẤT ngay lập tức.
  const runningRef = useRef(false);
  const stepIdxRef = useRef(0);
  const stepFramesRef = useRef(0);
  const marksRef = useRef<Mark[]>([]);
  const collectedRef = useRef<string[]>([]);
  const okStreakRef = useRef(0);
  const lastPoseRef = useRef<Pose | null>(null);
  const lastAcceptRef = useRef(0);
  const signsRef = useRef<Signs>({ yaw: 0, pitch: 0 });
  const blinkClosedRef = useRef(false);
  const blinkStartRef = useRef(0);
  const recStartRef = useRef(0);
  const recordedRef = useRef<Promise<VideoFile> | null>(null);
  const rotationRef = useRef<number | null>(null); // góc xoay cần để khung trích từ video đứng thẳng
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectorOptions = useRef(DETECTOR_OPTIONS).current;

  // Bộ nhận diện ảnh tĩnh (kiểm tra lại khung hình trích từ video) - tạo khi cần, trong try/catch
  const staticDetector = useRef<RNMLKitFaceDetector | null>(null);
  const pendingStartRef = useRef(false);

  useEffect(() => {
    getFaceApiUrl().then(setFaceApiUrlState);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kiểm tra tên trùng NGAY khi gõ (debounce).
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

  // ---------- Trích khung hình từ video đã quay ----------
  const extractFrames = useCallback(async (video: VideoFile, marks: Mark[]): Promise<string[]> => {
    const videoUri = video.path.startsWith("file://") ? video.path : `file://${video.path}`;
    const maxT = Math.max(0, Math.floor(video.duration * 1000) - 50);
    const out: string[] = [];

    for (let i = 0; i < marks.length; i++) {
      setProcessingText(`Đang trích khung hình ${i + 1}/${marks.length} từ video…`);
      const mark = marks[i];
      let looseUri: string | null = null; // có mặt nhưng góc lệch hơn dung sai
      let chosen: string | null = null;

      for (const off of EXTRACT_TIME_OFFSETS_MS) {
        const t = Math.min(maxT, Math.max(0, mark.t + off));
        let thumbUri: string;
        try {
          thumbUri = (await VideoThumbnails.getThumbnailAsync(videoUri, { time: t, quality: 0.9 })).uri;
        } catch {
          continue;
        }
        const rotations = rotationRef.current == null ? [0, 90, 270] : [rotationRef.current];
        for (const r of rotations) {
          let uri = thumbUri;
          if (r !== 0) {
            try {
              uri = (await ImageManipulator.manipulateAsync(thumbUri, [{ rotate: r }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG })).uri;
            } catch {
              continue;
            }
          }
          let fy = NaN;
          let fp = NaN;
          try {
            if (staticDetector.current == null) staticDetector.current = new RNMLKitFaceDetector({ performanceMode: "accurate" });
            const res = await staticDetector.current.detectFaces(uri);
            const faces = res?.faces ?? [];
            if (faces.length > 0) {
              const big = faces.reduce((a: any, b: any) => ((a.frame?.size?.x ?? 0) * (a.frame?.size?.y ?? 0) >= (b.frame?.size?.x ?? 0) * (b.frame?.size?.y ?? 0) ? a : b));
              fy = big.headEulerAngleY ?? 0;
              fp = big.headEulerAngleX ?? 0;
            }
          } catch {
            /* bỏ qua, coi như không thấy mặt */
          }
          if (Number.isNaN(fy)) continue;
          if (Math.abs(fy - mark.yaw) <= EXTRACT_TOLERANCE_DEG && Math.abs(fp - mark.pitch) <= EXTRACT_TOLERANCE_DEG) {
            rotationRef.current = r;
            chosen = uri;
            break;
          }
          if (!looseUri && (rotationRef.current == null || rotationRef.current === r)) looseUri = uri;
        }
        if (chosen) break;
      }
      const final = chosen ?? looseUri;
      if (final) out.push(final);
    }
    return out;
  }, []);

  // ---------- Dừng quay -> trích khung hình -> chuyển sang màn xác nhận ----------
  const finishRecording = useCallback(async () => {
    runningRef.current = false;
    setStage("processing");
    setProcessingText("Đang lưu video…");
    try {
      await cameraRef.current?.stopRecording();
      const video = await recordedRef.current;
      if (!video) throw new Error("Không nhận được file video");
      const marks = [...marksRef.current];
      const uris = await extractFrames(video, marks);
      collectedRef.current = [...collectedRef.current, ...uris];
      setCollectedUris([...collectedRef.current]);
      if (collectedRef.current.length < MIN_REGISTER_IMAGES) {
        setResultMsg({ ok: false, text: `Chỉ trích được ${collectedRef.current.length} khung hình rõ mặt (cần ≥ ${MIN_REGISTER_IMAGES}). Hãy quay lại ở nơi đủ sáng.` });
      }
      setStage("review");
    } catch (e: any) {
      setResultMsg({ ok: false, text: `Lỗi xử lý video: ${e?.message ?? e}` });
      setStage("form");
    }
  }, [extractFrames]);

  // ---------- Nhận kết quả nhận diện từng khung hình ĐANG QUAY ----------
  const onFaces = useCallback(
    (faces: Face[]) => {
      if (!runningRef.current) return;
      const step = POSES[stepIdxRef.current];
      const face = biggestFace(faces);
      if (!face) {
        okStreakRef.current = 0;
        lastPoseRef.current = null;
        setLiveHint("Đưa mặt vào giữa khung hình");
        return;
      }
      const pose: Pose = { yaw: face.yawAngle, pitch: face.pitchAngle };
      const { ok, hint } = evaluate(step, pose, signsRef.current);

      const last = lastPoseRef.current;
      const steady = !!last && Math.abs(pose.yaw - last.yaw) < STEADY_DELTA_DEG && Math.abs(pose.pitch - last.pitch) < STEADY_DELTA_DEG;
      lastPoseRef.current = pose;

      let canAccept = false;
      if (step.key === "blink") {
        const eyes = Math.min(face.leftEyeOpenProbability ?? 1, face.rightEyeOpenProbability ?? 1);
        if (blinkStartRef.current === 0) blinkStartRef.current = Date.now();
        if (ok && eyes >= 0 && eyes < 0.35) blinkClosedRef.current = true;
        const timedOut = Date.now() - blinkStartRef.current > BLINK_FALLBACK_MS;
        canAccept = ok && ((blinkClosedRef.current && eyes > 0.7) || timedOut);
        setLiveHint(ok ? (blinkClosedRef.current ? "Mở mắt ra, nhìn thẳng" : "Nhìn thẳng rồi chớp mắt tự nhiên") : hint);
      } else {
        okStreakRef.current = ok && steady ? okStreakRef.current + 1 : ok ? okStreakRef.current : 0;
        canAccept = okStreakRef.current >= STABLE_FRAMES_REQUIRED;
        setLiveHint(ok && !canAccept ? "Giữ yên…" : hint);
      }

      const now = Date.now();
      if (!canAccept || now - lastAcceptRef.current < MIN_GAP_BETWEEN_ACCEPTS_MS) return;

      // ---- ĐẠT GÓC: ghi mốc thời gian trong video ----
      lastAcceptRef.current = now;
      okStreakRef.current = 0;
      marksRef.current.push({ t: now - recStartRef.current, yaw: pose.yaw, pitch: pose.pitch, step: step.key });
      if (step.pairRole === "first") {
        if (step.axis === "yaw" && signsRef.current.yaw === 0) signsRef.current.yaw = Math.sign(pose.yaw);
        if (step.axis === "pitch" && signsRef.current.pitch === 0) signsRef.current.pitch = Math.sign(pose.pitch);
      }
      stepFramesRef.current += 1;
      setStepFrames(stepFramesRef.current);

      if (stepFramesRef.current >= step.framesNeeded) {
        const next = stepIdxRef.current + 1;
        if (next >= POSES.length) {
          finishRecording();
          return;
        }
        stepIdxRef.current = next;
        stepFramesRef.current = 0;
        blinkClosedRef.current = false;
        blinkStartRef.current = 0;
        setStepIdx(next);
        setStepFrames(0);
      }
    },
    [finishRecording],
  );

  // Callback ỔN ĐỊNH cho component Camera của thư viện nhận diện mặt (nó tự lo frame processor);
  // logic thật luôn lấy bản mới nhất qua ref.
  // KHÔNG dùng runAsync của vision-camera: với worklets-core 1.3.x nó làm app sập native
  // (SIGSEGV ở JsiWorkletContext::invokeOnWorkletThread) - chính thư viện face-detector cũng né nó.
  const onFacesRef = useRef(onFaces);
  onFacesRef.current = onFaces;
  const faceCallback = useCallback((faces: Face[]) => {
    onFacesRef.current(faces);
  }, []);

  // ---------- Bắt đầu 1 lượt quay ----------
  const startRound = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    stepIdxRef.current = 0;
    stepFramesRef.current = 0;
    marksRef.current = [];
    okStreakRef.current = 0;
    lastPoseRef.current = null;
    lastAcceptRef.current = 0;
    signsRef.current = { yaw: 0, pitch: 0 };
    blinkClosedRef.current = false;
    blinkStartRef.current = 0;
    setStepIdx(0);
    setStepFrames(0);
    setResultMsg(null);
    setLiveHint("Chuẩn bị…");

    let startError: string | null = null;
    recordedRef.current = new Promise<VideoFile>((resolve, reject) => {
      try {
        cam.startRecording({
          fileType: "mp4",
          videoCodec: "h264",
          onRecordingFinished: resolve,
          onRecordingError: (err) => reject(new Error(err?.message ?? "Lỗi quay video")),
        });
      } catch (e: any) {
        startError = e?.message ?? String(e);
        reject(e);
      }
    });
    // Lỗi thật được bắt ở finishRecording; ở đây chỉ chặn cảnh báo "unhandled rejection" và xử lý lỗi giữa chừng.
    recordedRef.current.catch(() => {
      if (!runningRef.current) return;
      runningRef.current = false;
      setResultMsg({ ok: false, text: "Không quay được video. Thử lại hoặc kiểm tra quyền camera." });
      setStage("form");
    });
    if (startError) {
      setResultMsg({ ok: false, text: `Không bắt đầu quay được: ${startError}` });
      setStage("form");
      return;
    }
    recStartRef.current = Date.now();
    runningRef.current = true;
    setStage("capturing");
  }, []);

  const handleBegin = useCallback(() => {
    if (!name.trim() || nameCheck.available === false) return;
    collectedRef.current = [];
    setCollectedUris([]);
    setResultMsg(null);
    pendingStartRef.current = true;
    setStage("starting"); // chỉ lúc này camera mới được mở; quay bắt đầu khi camera báo sẵn sàng
  }, [name, nameCheck.available]);

  // Quay thêm 1 lượt (đổi kính) - GIỮ các khung đã có.
  const handleExtraRound = useCallback(() => {
    setWantsGlassesRound(false);
    setResultMsg(null);
    pendingStartRef.current = true;
    setStage("starting");
  }, []);

  const handleCameraReady = useCallback(() => {
    if (!pendingStartRef.current) return;
    pendingStartRef.current = false;
    startRound();
  }, [startRound]);

  const handleCameraError = useCallback((e: any) => {
    pendingStartRef.current = false;
    runningRef.current = false;
    setResultMsg({ ok: false, text: `Lỗi camera: ${e?.message ?? e}` });
    setStage("form");
  }, []);

  // Camera mãi không sẵn sàng -> báo lỗi thay vì treo
  useEffect(() => {
    if (stage !== "starting") return;
    const t = setTimeout(() => {
      if (pendingStartRef.current) handleCameraError(new Error("Camera không khởi động được sau 8 giây"));
    }, 8000);
    return () => clearTimeout(t);
  }, [stage, handleCameraError]);

  const handleCancelCapture = useCallback(() => {
    runningRef.current = false;
    cameraRef.current?.cancelRecording().catch(() => {});
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
  if (!hasPermission) {
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
  if (!device) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.bodyText}>Không tìm thấy camera trước trên thiết bị này.</Text>
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

  // ==================== Đang trích khung hình từ video ====================
  if (stage === "processing") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.bodyText}>{processingText}</Text>
      </SafeAreaView>
    );
  }

  // ==================== Màn hình xác nhận gửi (không cần camera nữa) ====================
  if (stage === "review") {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Xác nhận đăng ký</Text>
        <Text style={styles.subtitle}>
          Đã quay xong và trích {collectedUris.length} khung hình ({POSES.length} góc) cho "{name}".
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
                  bắt đầu để quay thêm 1 lượt video nữa.
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
      {stage !== "form" && (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive
          video
          audio={false}
            faceDetectionCallback={faceCallback}
          faceDetectionOptions={detectorOptions}
          onInitialized={handleCameraReady}
          onError={handleCameraError}
        />
      )}

      {stage === "starting" && (
        <View style={styles.formOverlay}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.bodyText}>Đang mở camera…</Text>
        </View>
      )}

      {stage === "form" && (
        <View style={styles.formOverlay}>
          <SafeAreaView style={styles.formCard}>
            <Text style={styles.title}>Huấn luyện khuôn mặt tại chỗ</Text>
            <Text style={styles.subtitle}>
              Nhập tên người dùng. App sẽ QUAY VIDEO liên tục và tự nhận biết khi bạn đạt đúng góc mỗi bước rồi mới chuyển tiếp - không đếm
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
            {resultMsg ? <Text style={[styles.hintText, resultMsg.ok ? styles.successText : styles.errorText]}>{resultMsg.text}</Text> : null}
            <Text style={styles.apiUrlText}>Face API: {faceApiUrl || "…"} (sửa ở tab Khác → Cài đặt)</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!name.trim() || nameCheck.available === false) && styles.primaryBtnDisabled]}
              onPress={handleBegin}
              disabled={!name.trim() || nameCheck.available === false}
            >
              <Text style={styles.primaryBtnText}>Bắt đầu quay</Text>
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
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.topBarText}>ĐANG QUAY · {totalDone}/{TOTAL_FRAMES}</Text>
            </View>
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
              {stepFrames}/{currentStep.framesNeeded} lần đạt góc này
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

  formOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,14,0.92)", justifyContent: "center", alignItems: "stretch" },
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
  recBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
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


/** Bắt mọi lỗi JS trong màn hình này và hiện nội dung lỗi thay vì để app tự đóng. */
class EnrollErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.center}>
          <Ionicons name="warning-outline" size={32} color={colors.bad} />
          <Text style={[styles.bodyText, styles.errorText]}>Màn hình huấn luyện khuôn mặt gặp lỗi:</Text>
          <Text style={styles.apiUrlText}>{String(this.state.error.message || this.state.error)}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function FaceEnrollScreen() {
  return (
    <EnrollErrorBoundary>
      <FaceEnrollScreenInner />
    </EnrollErrorBoundary>
  );
}
