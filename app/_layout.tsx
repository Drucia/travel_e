import { type Href, Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';

import { PhonePreview } from '@/components/PhonePreview';
import { LoadingScreen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, storePendingJoinCode, useAuth } from '@/context/AuthContext';
import { parseJoinCodeFromUrl } from '@/lib/cloud/join';
import { migrateDbIfNeeded } from '@/lib/db/schema';
import { eventIdFromNotificationData } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <PhonePreview>
      <Suspense fallback={<LoadingScreen />}>
        <SQLiteProvider
          databaseName="ewidencja.db"
          onInit={migrateDbIfNeeded}
          useSuspense
          options={{ useNewConnection: Platform.OS === 'web' }}>
          <AuthProvider>
            <AppProvider>
              <AuthGate />
              <JoinLinkHandler />
              <NotificationGate />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  headerTitleStyle: { fontWeight: '700' },
                  contentStyle: { backgroundColor: colors.background },
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="setup" options={{ headerShown: false }} />
                <Stack.Screen name="groups" options={{ headerShown: false }} />
                <Stack.Screen name="event" options={{ headerShown: false }} />
                <Stack.Screen name="season" options={{ headerShown: false }} />
                <Stack.Screen name="destinations" options={{ headerShown: false }} />
                <Stack.Screen name="schedule" options={{ headerShown: false }} />
              </Stack>
            </AppProvider>
          </AuthProvider>
        </SQLiteProvider>
      </Suspense>
    </PhonePreview>
  );
}

function AuthGate() {
  const { configured, initializing, session } = useAuth();
  const { group, groupsLoaded } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;

    const root = String(segments[0] ?? '');

    if (!configured) {
      if (root !== 'setup') router.replace('/setup' as Href);
      return;
    }

    if (!session) {
      if (root !== 'login') router.replace('/login' as Href);
      return;
    }

    if (!groupsLoaded) return;

    if (root === 'login' || root === 'setup') {
      router.replace((group ? '/(tabs)' : '/groups') as Href);
      return;
    }

    if (!group && root !== 'groups') {
      router.replace('/groups' as Href);
    }
  }, [configured, groupsLoaded, group, initializing, router, segments, session]);

  useEffect(() => {
    if (!initializing && (groupsLoaded || !session || !configured)) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [configured, groupsLoaded, initializing, session]);

  return null;
}

function JoinLinkHandler() {
  const { configured, session } = useAuth();
  const { refresh } = useApp();

  useEffect(() => {
    if (!configured) return undefined;

    async function ingest(url: string | null) {
      if (!url) return;
      const code = parseJoinCodeFromUrl(url);
      if (!code) return;
      await storePendingJoinCode(code);
      if (session) await refresh();
    }

    void Linking.getInitialURL().then((url) => void ingest(url));
    const sub = Linking.addEventListener('url', ({ url }) => {
      void ingest(url);
    });
    return () => sub.remove();
  }, [configured, refresh, session]);

  return null;
}

function NotificationGate() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    function openFromResponse(response: Notifications.NotificationResponse | null) {
      const eventId = eventIdFromNotificationData(response?.notification.request.content.data);
      if (!eventId || handled.current === eventId) return;
      handled.current = eventId;
      router.push(`/event/${eventId}`);
    }

    const timeout = setTimeout(() => {
      try {
        openFromResponse(Notifications.getLastNotificationResponse());
      } catch {
        // unsupported
      }
    }, 400);

    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        handled.current = null;
        openFromResponse(response);
      });
    } catch {
      // unsupported
    }

    return () => {
      clearTimeout(timeout);
      sub?.remove();
    };
  }, [router]);

  return null;
}
