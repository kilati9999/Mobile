import React from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

interface Props {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}

/** Sparkline đơn giản (không trục, không nhãn) để xem nhanh xu hướng gần
 * đây - đủ dùng cho một widget nhỏ trên di động, không cần thư viện chart
 * đầy đủ như trên web (Chart.js). */
export default function MiniChart({ values, color, width = 280, height = 46 }: Props) {
  if (!values.length) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
