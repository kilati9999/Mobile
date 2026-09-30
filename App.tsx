import { FaceDetectionProvider } from "@infinitered/react-native-mlkit-face-detection";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FaceDetectionProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </FaceDetectionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
