import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Live: undefined;
  Devices: undefined;
  More: undefined;
};

export type RootStackParamList = {
  ServerSetup: undefined;
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  DeviceDetail: { deviceId: string };
  DeviceForm: { deviceId?: string } | undefined;
  ProvisionDevice: undefined;
  FaceEnroll: undefined;
  Logs: undefined;
  Settings: undefined;
};
