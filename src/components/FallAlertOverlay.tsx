import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ackFall, ApiError, getFallImage, getFalls } from "../api/client";
import type { FallAlert } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { colors, radius, spacing } from "../theme";

// Chỉ kêu chuông cho cảnh báo mới (chưa ai bấm "Đã xem" và chưa quá 10 phút);
// cảnh báo cũ hơn vẫn hiện banner nhưng im lặng.
const RING_MAX_AGE_S = 600;
const POLL_MS = 3000;

/**
 * Cảnh báo TÉ NGÃ từ camera công ty (server gc /api/falls) - hiện đè lên mọi màn hình,
 * kèm ảnh chụp lúc ngã, chuông lặp + rung tới khi có người bấm "Đã xem" (tắt trên mọi máy)
 * hoặc "Tắt chuông" (chỉ máy này).
 * Lưu ý: app chỉ kiểm tra khi đang mở (không có thông báo đẩy khi app tắt / chạy nền).
 */
export default function FallAlertOverlay() {
  const insets = useSafeAreaInsets();
  const { data, refresh } = usePolling<FallAlert[]>(getFalls, POLL_MS);
  const active = (data || []).filter((a) => !a.acknowledged);
  const top = active[0];
  const [images, setImages] = useState<Record<number, string>>({});
  const [mutedId, setMutedId] = useState<number | null>(null);
  const [acking, setAcking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const fresh = !!top && Date.now() / 1000 - top.ts < RING_MAX_AGE_S;
  const ringing = !!top && fresh && mutedId !== top.id;

  // Tải ảnh chụp của cảnh báo đang hiện
  useEffect(() => {
    if (!top?.has_image || images[top.id]) return;
    let cancelled = false;
    getFallImage(top.id)
      .then((b64) => {
        if (!cancelled) setImages((m) => ({ ...m, [top.id]: b64 }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [top?.id, top?.has_image]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chuông + rung
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (soundRef.current) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require("../../assets/fall_alarm.wav"), {
          isLooping: true,
          volume: 1.0,
          shouldPlay: true,
        });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        // không phát được âm thanh (thiết bị chặn...) -> vẫn còn rung + banner
      }
    }

    async function stop() {
      const s = soundRef.current;
      soundRef.current = null;
      if (s) {
        try {
          await s.stopAsync();
          await s.unloadAsync();
        } catch {
          // bỏ qua
        }
      }
    }

    if (ringing) {
      start();
      Vibration.vibrate([0, 700, 500], true);
    } else {
      stop();
      Vibration.cancel();
    }
    return () => {
      cancelled = true;
    };
  }, [ringing]);

  useEffect(
    () => () => {
      Vibration.cancel();
      const s = soundRef.current;
      soundRef.current = null;
      s?.unloadAsync().catch(() => {});
    },
    []
  );

  async function handleAck() {
    if (!top) return;
    setAcking(true);
    setError(null);
    try {
      await ackFall(active.length > 1 ? "all" : top.id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không gửi được xác nhận.");
    } finally {
      setAcking(false);
    }
  }

  if (!top) return null;
  const img = images[top.id];

  return (
    <View style={[styles.wrap, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.head}>
          <Ionicons name="warning" size={20} color={colors.bad} />
          <Text style={styles.title}>PHÁT HIỆN TÉ NGÃ</Text>
          {active.length > 1 ? <Text style={styles.more}>+{active.length - 1} cảnh báo khác</Text> : null}
        </View>
        <Text style={styles.camera}>
          {top.camera} · {top.time}
        </Text>
        <Text style={styles.message}>{top.message}</Text>

        {top.has_image ? (
          <View style={styles.imageBox}>
            {img ? (
              <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator color={colors.bad} />
            )}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() => setMutedId(top.id)}
            disabled={!ringing}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-mute" size={16} color={ringing ? colors.text : colors.textFaint} />
            <Text style={[styles.btnText, !ringing && { color: colors.textFaint }]}>Tắt chuông</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnAck]} onPress={handleAck} disabled={acking} activeOpacity={0.7}>
            {acking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>{active.length > 1 ? "Đã xem tất cả" : "Đã xem"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 1000, elevation: 1000 },
  card: {
    backgroundColor: "#2a1215",
    borderWidth: 1.5,
    borderColor: colors.bad,
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#fecaca", fontSize: 15, fontWeight: "800", flex: 1 },
  more: { color: "#fca5a5", fontSize: 11, fontWeight: "700" },
  camera: { color: "#fca5a5", fontSize: 12, fontWeight: "700", marginTop: 6, fontFamily: "monospace" },
  message: { color: colors.text, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  imageBox: {
    marginTop: spacing.sm,
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#000",
    borderRadius: radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  error: { color: "#fca5a5", fontSize: 11.5, marginTop: 6 },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: radius.sm,
  },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnAck: { backgroundColor: colors.bad },
  btnText: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
