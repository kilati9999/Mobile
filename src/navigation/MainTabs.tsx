import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { useAuth } from "../context/AuthContext";
import DevicesScreen from "../screens/DevicesScreen";
import HomeScreen from "../screens/HomeScreen";
import LiveScreen from "../screens/LiveScreen";
import MoreScreen from "../screens/MoreScreen";
import SensorsScreen from "../screens/SensorsScreen";
import { colors } from "../theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: any; inactive: any }> = {
  Home: { active: "home", inactive: "home-outline" },
  Live: { active: "hand-left", inactive: "hand-left-outline" },
  Sensors: { active: "thermometer", inactive: "thermometer-outline" },
  Devices: { active: "grid", inactive: "grid-outline" },
  More: { active: "menu", inactive: "menu-outline" },
};

export default function MainTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.border, height: 58, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        tabBarIcon: ({ focused, color, size }) => {
          const set = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? set.active : set.inactive} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Trang chủ" }} />
      <Tab.Screen name="Live" component={LiveScreen} options={{ title: "Trực tiếp" }} />
      <Tab.Screen name="Sensors" component={SensorsScreen} options={{ title: "Cảm biến" }} />
      {isAdmin && <Tab.Screen name="Devices" component={DevicesScreen} options={{ title: "Thiết bị" }} />}
      <Tab.Screen name="More" component={MoreScreen} options={{ title: "Khác" }} />
    </Tab.Navigator>
  );
}
