import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRef } from 'react';
import { router, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/auth-store';
import { usePatientStore } from '../../src/stores/patient-store';
import { Button } from '../../src/components/ui';
import { PinDialog } from '../../src/components/shared';
import { ThemeColors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { useTheme } from '../../src/hooks/useTheme';
import { layout } from '../../src/theme/layout';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export default function CaregiverDashboard() {
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuthStore();
  const { patient, settings, fetchPatient } = usePatientStore();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinError, setPinError] = useState<string>();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const theme = useTheme();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.9)).current;
  const blurAnim = useRef(new Animated.Value(0)).current;

  const isLargeScreen = windowWidth > layout.maxWidth;
  const styles = getStyles(theme, isLargeScreen);

  if (user?.role === 'supporter') {
    return <Redirect href="/(supporter)" />;
  }

  useEffect(() => {
    if (!patient?.id) {
      fetchPatient();
    } else if (!settings) {
      fetchPatient(patient.id);
    }
  }, [patient?.id, settings, fetchPatient]);

  const handleSettingsPress = () => {
    if (settings?.settings_pin) {
      setShowPinDialog(true);
    } else {
      router.push('/(caregiver)/settings');
    }
  };

  const handlePinConfirm = (pin: string) => {
    if (pin === settings?.settings_pin) {
      setShowPinDialog(false);
      setPinError(undefined);
      router.push('/(caregiver)/settings');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleStartSession = () => {
    setIsTransitioning(true);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(blurAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(logoFadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(logoScaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          })
        ])
      ])
    ]).start(() => {
      // Small additional delay to feel "deliberate"
      setTimeout(() => {
        router.push('/therapy/session');
        // Reset animation state for when user comes back
        setTimeout(() => {
          setIsTransitioning(false);
          fadeAnim.setValue(1);
          logoFadeAnim.setValue(0);
          logoScaleAnim.setValue(0.9);
          blurAnim.setValue(0);
        }, 500);
      }, 300);
    });
  };

  const name = user?.full_name?.split(' ')[0] || 'there';

  return (
    <View style={styles.container}>
      {/* 1. Full-screen Blurred Background Layer */}
      {patient?.photo_url && (
        <>
          <Image
            source={{ uri: patient.photo_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={Platform.OS === 'ios' ? 20 : 10}
          />
          {/* Subtle dark overlay to make the blurred background less distracting */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        </>
      )}

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={styles.contentWrapper}>
          {/* 2. Original Image Layer (Inside 800px container) */}
          {patient?.photo_url ? (
            <Image
              source={{ uri: patient.photo_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[theme.background, theme.surface]}
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Gradients for readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'transparent']}
            style={[styles.gradientOverlay, { top: 0, height: '40%' }]}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
            style={[styles.gradientOverlay, { bottom: 0, height: '40%' }]}
          />

          {/* 3. Content Layer */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={handleSettingsPress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cog-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.mainContent, { opacity: fadeAnim }]}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingText}>
                {getGreeting()},
              </Text>
              <Text style={styles.greetingText}>
                {name}!
              </Text>
            </View>

            <View style={styles.footer}>
              <Button
                title="Start Reminiscing"
                onPress={handleStartSession}
                size="large"
                disabled={isTransitioning}
                style={styles.startButton}
                textStyle={styles.startButtonText}
              />
            </View>
          </Animated.View>

        </Animated.View>

        <PinDialog
          visible={showPinDialog}
          onConfirm={handlePinConfirm}
          onCancel={() => {
            setShowPinDialog(false);
            setPinError(undefined);
          }}
          error={pinError}
        />
      </SafeAreaView>

      {/* Full-Screen Transition Overlay */}
      {isTransitioning && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.primary,
              opacity: blurAnim,
              zIndex: 1000, // Ensure it's above everything including backgrounds
              justifyContent: 'center',
              alignItems: 'center',
            }
          ]}
        >
          <Animated.View style={{
            opacity: logoFadeAnim,
            transform: [{ scale: logoScaleAnim }],
            alignItems: 'center'
          }}>
            <Image
              source={require('../../assets/images/Code_Blue_Panda_Logo_Final.png')}
              style={{ width: 250, height: 250, marginBottom: spacing.lg }}
              resizeMode="contain"
            />
            <Text style={[typography.heading1, { color: '#FFF', letterSpacing: 2 }]}>
              Reminisce
            </Text>
            <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.6)', marginTop: spacing.xl, textAlign: 'center' }]}>
              Curating memories for {patient?.first_name || 'you'}...
            </Text>
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 40 }} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors, isLargeScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxWidth,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
      },
      android: {
        elevation: 20,
      },
      web: {
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }
    }),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: isLargeScreen ? spacing.xxl : spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
    zIndex: 10,
  },
  greetingContainer: {
    marginTop: spacing.xl,
  },
  greetingText: {
    ...typography.heading1,
    fontSize: isLargeScreen ? 48 : 42,
    lineHeight: isLargeScreen ? 56 : 50,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
    zIndex: 20,
  },
  startButton: {
    minWidth: '70%',
    maxWidth: '90%',
    minHeight: 72,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 36,
    backgroundColor: theme.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }
    }),
  },
  startButtonText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});


