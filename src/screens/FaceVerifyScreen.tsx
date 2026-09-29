/**
 * FaceVerifyScreen.tsx
 * ====================
 * Màn hình "Xác thực khuôn mặt" - gọi POST /verify của Face Auth API.
 * main.py yêu cầu 1 CHÙM ảnh liên tiếp (>= MIN_BURST_IMAGES = 3, xem
 * main.py) để kiểm tra chống giả mạo (ảnh/video tĩnh) - KHÁC với
 * /register (nhiều góc cố định để đăng ký). Ở đây chỉ cần chụp nhanh vài
 * tấm liên tiếp trong lúc nhìn thẳng camera, không cần đổi tư thế.
 */
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FaceApiError, faceVerify } from "../api/faceApi";
import FaceLoginForm from "../components/FaceLoginForm";
import { useFaceAuth } from "../hooks/useFaceAuth";
import { colors, radius, spacing, typography } from "../theme";

const BURST_COUNT = 4; // > MIN_BURST_IMAGES (3) của main.py, có dư 1 ảnh phòng lỗi chụp
const BURST_INTERVAL_MS = 250;
const READY_COUNTDOWN_SECONDS = 2;

type Stage = "idle" | "countdown" | "capturing" | "checking" | "result";
type VerifyResult = { ok: boolean; text: string } | null;

export default function FaceVerifyScreen() {
  const { token, login } = useFaceAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [countdown, setCountdown] = useState(READY_COUNTDOWN_SECONDS);
  const [result, setResult] = useState<VerifyResult>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const captureBurstAndVerify = useCallback(async () => {
    setStage("capturing");
    const uris: string[] = [];
    for (let i = 0; i < BURST_COUNT; i++) {
      try {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8, skipProcessing: true });
        if (photo?.uri) uris.push(photo.uri);
      } catch {
        // bỏ qua 1 lần chụp lỗi trong chùm - vẫn còn các ảnh khác
      }
      if (i < BURST_COUNT - 1) {
        await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
      }
    }

    setStage("checking");
    try {
      const data = await faceVerify(uris);
      if (data.success) {
        setResult({ ok: true, text: `${data.message} (độ khớp ${(data.confidence * 100).toFixed(1)}%)` });
      } else {
        setResult({ ok: false, text: `${data.message}${data.confidence ? ` (độ khớp ${(data.confidence * 100).toFixed(1)}%)` : ""}` });
      }
    } catch (e) {
      const text = e instanceof FaceApiError ? e.message : "Không kết nối được tới Face API - kiểm tra lại địa chỉ trong Cài đặt.";
      setResult({ ok: false, text });
    } finally {
      setStage("result");
    }
  }, []);

  const handleStart = useCallback(() => {
    setResult(null);
    setCountdown(READY_COUNTDOWN_SECONDS);
    setStage("countdown");
  }, []);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown <= 0) {
      captureBurstAndVerify();
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage, countdown, captureBurstAndVerify]);

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
        <Text style={styles.bodyText}>Cần quyền truy cập camera để xác thực khuôn mặt.</Text>
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

  // ==================== Màn hình kết quả (không cần camera nữa) ====================
  if (stage === "result" && result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.resultIconWrap, { backgroundColor: result.ok ? colors.goodSoft : colors.badSoft }]}>
          <Ionicons name={result.ok ? "checkmark-circle" : "close-circle"} size={40} color={result.ok ? colors.good : colors.bad} />
        </View>
        <Text style={styles.title}>{result.ok ? "Xác thực thành công" : "Không xác thực được"}</Text>
        <Text style={[styles.subtitle, { textAlign: "center" }]}>{result.text}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
          <Text style={styles.primaryBtnText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ==================== "idle" / "countdown" / "capturing" / "checking" - camera mount xuyên suốt ====================
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="picture" />

      {stage === "idle" && (
        <View style={styles.formOverlay}>
          <SafeAreaView style={styles.formCard}>
            <Text style={styles.title}>Xác thực khuôn mặt</Text>
            <Text style={styles.subtitle}>
              Nhìn thẳng vào camera rồi bấm "Xác thực" - app sẽ chụp nhanh {BURST_COUNT} ảnh liên tiếp để kiểm tra
              khớp với người dùng đã đăng ký (đồng thời kiểm tra chống giả mạo ảnh/video tĩnh).
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
              <Text style={styles.primaryBtnText}>Xác thực</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      {(stage === "countdown" || stage === "capturing" || stage === "checking") && (
        <SafeAreaView edges={["bottom"]} style={styles.overlay}>
          {stage === "countdown" && (
            <>
              <Text style={styles.instructionText}>Nhìn thẳng vào camera</Text>
              <Text style={styles.countdownText}>{countdown > 0 ? countdown : "📸"}</Text>
            </>
          )}
          {stage === "capturing" && (
            <>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.holdLabel}>Đang chụp, giữ yên…</Text>
            </>
          )}
          {stage === "checking" && (
            <>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.holdLabel}>Đang kiểm tra khuôn mặt…</Text>
            </>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: "center", alignItems: "center" },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { color: colors.textDim, fontSize: 13.5, marginBottom: spacing.xl, lineHeight: 20 },
  bodyText: { color: colors.textDim, fontSize: 13.5, textAlign: "center", marginTop: spacing.md },
  resultIconWrap: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: "center", marginTop: spacing.md },
  primaryBtnText: { color: "#04141c", fontSize: 15, fontWeight: "800" },

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
  instructionText: { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: spacing.md },
  countdownText: { color: colors.accent, fontSize: 48, fontWeight: "800" },
  holdLabel: { color: colors.textDim, fontSize: 13, marginTop: spacing.sm },
});
