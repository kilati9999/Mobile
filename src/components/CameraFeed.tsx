import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { getCameraUrl } from "../api/client";
import { colors, radius, spacing } from "../theme";

// Ép trang của camera vừa khít chiều ngang khung xem (ảnh/video co theo chiều rộng).
const FIT_SCRIPT = `
(function () {
  var m = document.querySelector('meta[name=viewport]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  m.content = 'width=device-width, initial-scale=1';
  var s = document.createElement('style');
  s.innerHTML = 'html,body{margin:0;padding:0;background:#000;overflow:hidden}img,video,canvas{width:100%!important;height:auto!important;display:block}';
  document.head.appendChild(s);
})();
true;
`;

/** Khung xem hình ảnh trực tiếp từ camera (địa chỉ đặt trong Cài đặt). */
export default function CameraFeed() {
  const focused = useIsFocused();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // đọc lại mỗi lần quay về tab (đề phòng vừa đổi địa chỉ trong Cài đặt)
    if (focused) getCameraUrl().then(setUrl);
  }, [focused]);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Ionicons name="videocam" size={15} color={colors.accent} />
          <Text style={styles.title}>Camera</Text>
        </View>
        <TouchableOpacity onPress={reload} hitSlop={10} accessibilityLabel="Tải lại camera">
          <Ionicons name="refresh" size={18} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      <View style={styles.frame}>
        {focused && url ? (
          <WebView
            key={`${url}-${reloadKey}`}
            source={{ uri: url }}
            style={styles.web}
            originWhitelist={["*"]}
            injectedJavaScript={FIT_SCRIPT}
            scrollEnabled={false}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            mixedContentMode="always"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => setError(e.nativeEvent.description || "Không kết nối được camera")}
            onHttpError={(e) => setError(`Camera trả về lỗi HTTP ${e.nativeEvent.statusCode}`)}
          />
        ) : null}

        {loading && !error ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.overlay}>
            <Ionicons name="videocam-off" size={22} color={colors.textFaint} />
            <Text style={styles.errText}>{error}</Text>
            <Text style={styles.errHint}>
              Điện thoại cần cùng mạng với camera (hoặc dùng Tailscale). Địa chỉ: {url}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={reload}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "700" },
  frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: radius.sm, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: spacing.md, gap: 6, backgroundColor: "rgba(0,0,0,0.55)" },
  errText: { color: colors.text, fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  errHint: { color: colors.textFaint, fontSize: 11, textAlign: "center" },
  retryBtn: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 7 },
  retryText: { color: colors.text, fontSize: 12, fontWeight: "700" },
});
