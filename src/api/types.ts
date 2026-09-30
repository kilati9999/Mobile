export type Role = "admin" | "khach";

export interface User {
  username: string;
  role: Role;
  display_name: string;
  site_id: string | null;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  unit: string | null;
  site_id: string;
  site_name: string | null;
  site_address: string | null;
  state: boolean;
  level: number | null;
  power: boolean;
  online: boolean;
  error: boolean;
  error_reason: string | null;
  power_source: string;
  battery: number | null;
  last_seen: string | null;
  mac: string | null;
  ip: string | null;
  assigned_user: string | null;
  esp_connected: boolean;
  esp_last_seen: string | null;
  esp_status: "connected" | "disconnected" | "unconfigured";
  status: "ok" | "power_off" | "offline" | "error";
  status_label: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  device_count: number;
  online_count: number;
  issue_count?: number;
  network_outage: boolean;
  devices?: Device[];
}

export interface HandState {
  gesture: string;
  confidence: number;
  buffer: number;
  tracked: boolean;
  updated_at: string | null;
}

export interface HistoryEntry {
  id: number;
  time: string;
  hand: string | null;
  gesture: string | null;
  confidence: number;
  action: string;
  device: string;
  site_id: string;
  site_name: string | null;
  applied: boolean;
  note: string | null;
}

export interface StateResponse {
  hands: { Trái: HandState; Phải: HandState };
  devices: Device[];
  sites: Site[];
  selected_device: string | null;
  history: HistoryEntry[];
  stats: {
    total_today: number;
    avg_confidence: number;
    devices_on: number;
    devices_issue: number;
    sites_outage: number;
    uptime_min: number;
  };
}

export interface SensorSite {
  site_id: string;
  site_name: string;
  site_address: string;
  temperature: number;
  humidity: number;
  gas: number;
  fire_alert: boolean;
  source?: "real" | "sim" | string;
  updated_at: string | null;
  history: { time: string; temperature: number; humidity: number; gas: number }[];
}

export interface SensorAlert {
  id: number;
  time: string;
  site_id: string;
  site_name: string;
  type: "fire" | "cleared";
  message: string;
}

export interface Account {
  username: string;
  display_name: string;
  role: Role;
  site_id: string | null;
}

export interface PendingBoard {
  chip_id: string;
  ip: string | null;
  status: "connected" | "disconnected";
  first_seen: string;
  last_seen: string;
}

export interface SensorsResponse {
  sites: SensorSite[];
  alerts: SensorAlert[];
  thresholds: { temperature: number; gas: number };
}
