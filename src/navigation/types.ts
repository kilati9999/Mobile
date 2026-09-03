import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Live: undefined;
  Sensors: undefined;
  Devices: undefined;
  More: undefined;
};

export type RootStackParamList = {
  ServerSetup: undefined;
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  DeviceDetail: { deviceId: string };
  ProvisionDevice: undefined;
  History: undefined;
  Settings: undefined;
};
