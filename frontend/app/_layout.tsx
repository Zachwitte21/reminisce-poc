import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, useColorScheme, Platform, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../src/hooks/useTheme';
import { layout } from '../src/theme/layout';
import { initializeNotifications } from '../src/services/notifications';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const theme = useTheme();
  const colorScheme = useColorScheme();

  const notificationListenerRef = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    initializeNotifications();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'therapy_reminder') {
        router.push('/(caregiver)');
      }
    });
    notificationListenerRef.current = subscription;

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const content = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(caregiver)" />
      <Stack.Screen name="(supporter)" />
      <Stack.Screen name="therapy" />
    </Stack>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { backgroundColor: '#00070a' }]}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.webContent}>
          {content}
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webContent: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
