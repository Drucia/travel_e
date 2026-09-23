import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhoneFrameContext } from '@/components/PhonePreview';
import { colors } from '@/constants/theme';

const TAB_CONTENT_HEIGHT = 72;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const inPhoneFrame = useContext(PhoneFrameContext);
  const bottomPad = Math.max(insets.bottom, inPhoneFrame ? 22 : 8);

  return (
    <Tabs
      safeAreaInsets={{ top: insets.top, bottom: 0, left: 0, right: 0 }}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700', color: colors.text, fontSize: 20 },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: TAB_CONTENT_HEIGHT + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          overflow: 'visible',
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 6,
          overflow: 'visible',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 16,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 0,
          paddingBottom: 1,
          overflow: 'visible',
        },
        tabBarIconStyle: {
          marginTop: 0,
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
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accent,
  },
});
