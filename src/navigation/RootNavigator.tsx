import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import DeviceDetailScreen from "../screens/DeviceDetailScreen";
import DeviceFormScreen from "../screens/DeviceFormScreen";
import FaceEnrollScreen from "../screens/FaceEnrollScreen";
import LogsScreen from "../screens/LogsScreen";
import LoginScreen from "../screens/LoginScreen";
import ProvisionDeviceScreen from "../screens/ProvisionDeviceScreen";
import ServerSetupScreen from "../screens/ServerSetupScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../theme";
import MainTabs from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: "700" as const },
};

export default function RootNavigator() {
  const { user, booting, serverConfigured } = useAuth();

  if (booting) {
    return (
      <View style={styles.bootWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.bootText}>Đang khởi động…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ ...headerOptions }}>
      {!serverConfigured ? (
        <Stack.Screen name="ServerSetup" component={ServerSetupScreen} options={{ headerShown: false }} />
      ) : !user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="DeviceDetail"
            component={DeviceDetailScreen}
            options={{ title: "Chi tiết thiết bị" }}
          />
          <Stack.Screen
            name="DeviceForm"
            component={DeviceFormScreen}
            options={({ route }) => ({ title: route.params?.deviceId ? "Sửa thiết bị" : "Thêm thiết bị mới" })}
          />
          <Stack.Screen
            name="ProvisionDevice"
            component={ProvisionDeviceScreen}
            options={{ title: "Thêm board ESP32" }}
          />
          <Stack.Screen name="FaceEnroll" component={FaceEnrollScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Logs" component={LogsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  bootWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: 12 },
  bootText: { color: colors.textFaint, fontSize: 12.5 },
});
