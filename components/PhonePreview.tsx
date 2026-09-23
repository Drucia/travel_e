import { createContext, type ReactNode, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { shouldUseFullScreenWeb } from '@/lib/pwa';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const BEZEL_WIDTH = PHONE_WIDTH + 16;
const BEZEL_HEIGHT = PHONE_HEIGHT + 52;
const FRAME_BOTTOM_INSET = 22;

export const PhoneFrameContext = createContext(false);

export function PhonePreview({ children }: { children: ReactNode }) {
  const scale = usePhoneScale(BEZEL_WIDTH, BEZEL_HEIGHT);
  const [fullScreen, setFullScreen] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const update = () => setFullScreen(shouldUseFullScreenWeb());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (Platform.OS !== 'web' || fullScreen) {
    return (
      <PhoneFrameContext.Provider value={false}>
        <View style={styles.full}>{children}</View>
      </PhoneFrameContext.Provider>
    );
  }

  return (
    <PhoneFrameContext.Provider value={true}>
      <View style={styles.desktop}>
        <Text style={styles.caption}>Podgląd telefonu · 390×844</Text>
        <View style={{ width: BEZEL_WIDTH * scale, height: BEZEL_HEIGHT * scale }}>
          <View
            style={[
              styles.scaled,
              {
                transform: [{ scale }],
                transformOrigin: 'top left',
              },
            ]}>
            <View style={styles.bezel}>
              <View style={styles.statusBar}>
                <Text style={styles.statusTime}>9:41</Text>
                <View style={styles.island} />
                <Text style={styles.statusMeta}>▮▮▮ 100%</Text>
              </View>
              <View style={styles.screen}>
                <SafeAreaProvider
                  initialMetrics={{
                    frame: { x: 0, y: 0, width: PHONE_WIDTH, height: PHONE_HEIGHT },
                    insets: { top: 0, right: 0, bottom: FRAME_BOTTOM_INSET, left: 0 },
                  }}>
                  <View style={styles.appRoot}>{children}</View>
                </SafeAreaProvider>
              </View>
              <View style={styles.homeIndicator} />
            </View>
          </View>
        </View>
      </View>
    </PhoneFrameContext.Provider>
  );
}

function usePhoneScale(width: number, height: number) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const update = () => {
      const availableW = window.innerWidth - 32;
      const availableH = window.innerHeight - 72;
      setScale(Math.min(1, availableW / width, availableH / height));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [height, width]);

  return scale;
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    backgroundColor: colors.background,
  },
  desktop: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  caption: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  scaled: {
    width: BEZEL_WIDTH,
    height: BEZEL_HEIGHT,
  },
  bezel: {
    width: BEZEL_WIDTH,
    height: BEZEL_HEIGHT,
    backgroundColor: '#0A0A0A',
    borderRadius: 44,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    boxShadow: '0 18px 28px rgba(0,0,0,0.45)',
  },
  statusBar: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  statusTime: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    width: 54,
  },
  island: {
    width: 92,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  statusMeta: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    width: 54,
    textAlign: 'right',
  },
  screen: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderRadius: 32,
  },
  appRoot: {
    flex: 1,
    height: '100%',
  },
  homeIndicator: {
    alignSelf: 'center',
    width: 120,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3A3A3A',
    marginTop: 7,
  },
});
