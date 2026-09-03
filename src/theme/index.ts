// Design tokens - cùng ngôn ngữ hình ảnh với web dashboard (nền tối, 3 màu
// nhấn: teal = tín hiệu sống, tím = tay trái, xanh dương = tay phải),
// nhưng chuẩn mật độ/typography cho màn hình di động.
export const colors = {
  bg: "#080a0e",
  bgElevated: "#0d1016",
  card: "#12161d",
  cardAlt: "#171c25",
  border: "#1f2630",
  borderStrong: "#2a323d",
  text: "#eef2f7",
  textDim: "#94a0b2",
  textFaint: "#5a6472",
  accent: "#5eead4",
  accentSoft: "rgba(94,234,212,0.14)",
  violet: "#a78bfa",
  violetSoft: "rgba(167,139,250,0.16)",
  sky: "#38bdf8",
  skySoft: "rgba(56,189,248,0.16)",
  good: "#34d399",
  goodSoft: "rgba(52,211,153,0.14)",
  warn: "#fbbf24",
  warnSoft: "rgba(251,191,36,0.14)",
  bad: "#f87171",
  badSoft: "rgba(248,113,113,0.14)",
};

export const gradients = {
  signal: [colors.violet, colors.accent, colors.sky] as const,
  header: ["#171c2b", "#10131a"] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const typography = {
  h1: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.2 },
  h3: { fontSize: 15, fontWeight: "700" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  small: { fontSize: 12, fontWeight: "500" as const },
  eyebrow: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.1, textTransform: "uppercase" as const },
  mono: { fontFamily: "monospace" },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

// Icon + màu theo loại thiết bị (Ionicons name), dùng ở DeviceCard/HomeScreen
export const DEVICE_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  dimmer: { icon: "bulb", label: "Đèn", color: colors.warn },
  speed: { icon: "aperture", label: "Quạt", color: colors.sky },
  switch: { icon: "flash", label: "Ổ cắm / relay", color: colors.violet },
};

export function deviceMeta(type: string) {
  return DEVICE_TYPE_META[type] || { icon: "hardware-chip", label: "Thiết bị", color: colors.textDim };
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  ok: { label: "Hoạt động tốt", color: colors.good },
  power_off: { label: "Mất nguồn", color: colors.bad },
  offline: { label: "Mất kết nối", color: colors.bad },
  error: { label: "Lỗi thiết bị", color: colors.bad },
};

export const ESP_STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: "Đã kết nối ESP32", color: colors.good },
  disconnected: { label: "Mất kết nối ESP32", color: colors.bad },
  unconfigured: { label: "Chưa gán ESP32", color: colors.textFaint },
};
