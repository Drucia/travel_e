import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700', color: colors.text, fontSize: 20 },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kalendarz',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="stats-chart-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="seasons"
        options={{
          title: 'Sezony',
          tabBarIcon: ({ focused }) => <TabIcon name="trophy-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ focused }) => <TabIcon name="settings-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accent,
  },
});
