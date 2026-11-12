import type { Device, DoorCmd } from "../api/types";

// Cửa cuốn = thiết bị MQTT gán slot "door" của board ESP32 (gc/firmware/esp32_devices),
// hoặc cửa cuốn công ty nối công tắc Touch4 (chỉ có Mở / Đóng).
export function isTouch4Door(d: Device): boolean {
  return d.conn_type === "touch4" && d.touch4_slot === "door";
}

export function isRollerDoor(d: Device): boolean {
  return (d.conn_type === "mqtt" && d.mqtt_slot === "door") || isTouch4Door(d);
}

// Firmware MANUAL_MODE: OPEN = chạy lên, CLOSE = chạy xuống, STOP = dừng; chạy liên tục
// tới khi bấm Dừng hoặc chạm công tắc hành trình; cấp điện cửa đứng yên (STOPPED).
const LABEL_MANUAL: Record<string, string> = {
  CLOSED: "Ở dưới cùng",
  OPENING: "Đang chạy lên…",
  OPEN: "Ở trên cùng",
  CLOSING: "Đang chạy xuống…",
  STOPPED: "Đứng yên",
  ERROR: "Lỗi công tắc hành trình",
};

const LABEL_AUTO: Record<string, string> = {
  CLOSED: "Đã đóng",
  OPENING: "Đang mở…",
  OPEN: "Đang mở",
  CLOSING: "Đang đóng…",
  STOPPED: "Đã dừng giữa chừng",
  ERROR: "Lỗi (kiểm tra công tắc hành trình)",
};

const ERROR_LABEL: Record<string, string> = {
  CLOSE_TIMEOUT: "Lỗi: đóng quá lâu, chưa chạm công tắc DƯỚI",
  OPEN_TIMEOUT: "Lỗi: mở quá lâu, chưa chạm công tắc TRÊN",
  BOTH_LIMITS: "Lỗi: 2 công tắc hành trình cùng báo chạm",
};

export function doorStateLabel(d: Device): string {
  const st = d.door_state || "";
  if (st === "ERROR" && d.door_error && ERROR_LABEL[d.door_error]) return ERROR_LABEL[d.door_error];
  const labels = d.door_manual ? LABEL_MANUAL : LABEL_AUTO;
  return labels[st] || "Chưa có trạng thái";
}

export function isDoorMoving(d: Device): boolean {
  return d.door_state === "OPENING" || d.door_state === "CLOSING";
}

// Nút nào vô nghĩa với trạng thái hiện tại thì khoá lại. Dừng LUÔN bấm được (an toàn).
export function doorCmdDisabled(d: Device, cmd: DoorCmd): boolean {
  if (d.status !== "ok") return true;
  if (isTouch4Door(d)) return cmd === "open" ? d.state : cmd === "close" ? !d.state : true;
  if (cmd === "stop") return false;
  if (!d.door_manual) return false;
  const st = d.door_state;
  if (cmd === "open") return st === "OPENING" || st === "OPEN";
  return st === "CLOSING" || st === "CLOSED";
}

export const DOOR_BUTTONS: { cmd: DoorCmd; icon: string; manual: string; auto: string }[] = [
  { cmd: "open", icon: "chevron-up", manual: "Lên", auto: "Mở" },
  { cmd: "stop", icon: "stop", manual: "Dừng", auto: "Dừng" },
  { cmd: "close", icon: "chevron-down", manual: "Xuống", auto: "Đóng" },
];

/** Nút hiện cho từng loại cửa: Touch4 không có lệnh Dừng. */
export function doorButtons(d: Device) {
  return isTouch4Door(d) ? DOOR_BUTTONS.filter((b) => b.cmd !== "stop") : DOOR_BUTTONS;
}
