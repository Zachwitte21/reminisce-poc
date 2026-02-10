import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  useWindowDimensions,
  Platform,
  Animated,
} from 'react-native';
import { useRef } from 'react';
import { router, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useSettingsStore, usePatientStore, useScheduleStore } from '../../src/stores';
import { Card } from '../../src/components/ui';
import { ConfirmationDialog, PinDialog, PhotoManagementDialog, EditPatientDialog, HomePhotoDialog, SupporterManagementDialog } from '../../src/components/shared';
import { ThemeColors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { useTheme } from '../../src/hooks/useTheme';
import { formatDisplayDate } from '../../src/utils/date';
import { layout } from '../../src/theme/layout';

export default function SettingsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { user, logout } = useAuthStore();
  const settingsStore = useSettingsStore();
  const { themePreference, setThemePreference } = settingsStore;
  const { patient, settings, updateSettings, fetchPatient, setPatient } = usePatientStore();
  const { schedule, fetchSchedule: fetchScheduleData } = useScheduleStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showRemovePinDialog, setShowRemovePinDialog] = useState(false);
  const [showPhotoManagement, setShowPhotoManagement] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showHomePhotoDialog, setShowHomePhotoDialog] = useState(false);
  const [showSupporterManagement, setShowSupporterManagement] = useState(false);
  const [pinError, setPinError] = useState<string>();
  const theme = useTheme();

  const isLargeScreen = windowWidth > layout.maxWidth;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;
  const styles = getStyles(theme, contentPadding);

  const { height: windowHeight } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(-windowHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -windowHeight,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      })
    ]).start(() => {
      router.back();
    });
  };

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

  useEffect(() => {
    if (patient?.id) {
      fetchScheduleData(patient.id);
    }
  }, [patient?.id]);

  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const scheduleSummary = (() => {
    if (!schedule?.sessions?.length) return 'Personalize your therapy reminders';
    const enabled = schedule.sessions.filter((s) => s.enabled);
    if (enabled.length === 0) return 'No active sessions';
    const days = [...new Set(enabled.map((s) => s.day_of_week))].sort();
    const dayNames = days.map((d) => DAYS_SHORT[d]).join(', ');
    const times = [...new Set(enabled.map((s) => s.time_of_day))];
    if (times.length === 1) {
      const [h, m] = times[0].split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${dayNames} at ${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    return `${dayNames} (${enabled.length} sessions)`;
  })();

  const isCaregiver = user?.role === 'caregiver';

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Account Scheduled for Deletion',
      'Your account will be deleted in 30 days. You can log back in to cancel.'
    );
    setShowDeleteDialog(false);
    handleLogout();
  };

  const handleExportData = () => {
    Alert.alert('Export Started', 'You will receive an email with your data export shortly.');
  };

  const handleUpdatePin = async (newPin: string) => {
    if (!patient?.id) return;
    try {
      await updateSettings(patient.id, { settings_pin: newPin });
      setShowPinDialog(false);
      Alert.alert('Success', 'Settings PIN updated successfully.');
    } catch {
      setPinError('Failed to update PIN. Please try again.');
    }
  };

  const handleClearPin = async () => {
    if (!patient?.id) return;
    try {
      await updateSettings(patient.id, { settings_pin: null });
      setShowRemovePinDialog(false);
      Alert.alert('Success', 'Settings PIN removed.');
    } catch {
      Alert.alert('Error', 'Failed to remove PIN.');
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.overlay,
          { opacity: overlayOpacity }
        ]}
      />
      <Animated.View style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleClose}
                >
                  <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSpacer} />
              </View>

              {isCaregiver && (
                <>
                  <Text style={styles.sectionTitle}>Patient Profile</Text>
                  <Card style={styles.card}>
                    <TouchableOpacity onPress={() => setShowEditProfile(true)} style={styles.menuItem}>
                      <View style={styles.avatar}>
                        {user?.avatar_url ? (
                          <Image source={{ uri: user.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                        ) : (
                          <Ionicons name="person" size={32} color={theme.textLight} />
                        )}
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={styles.accountName}>{patient?.first_name} {patient?.last_name}</Text>
                        <Text style={styles.accountEmail}>{patient?.relationship}</Text>
                        {patient?.birth_date && (
                          <Text style={styles.accountBirthday}>
                            Born {formatDisplayDate(patient.birth_date)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.editIconContainer}>
                        <Ionicons name="pencil-outline" size={20} color={theme.primary} />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <View style={styles.themeSelector}>
                      <Text style={styles.themeSelectorLabel}>Theme</Text>
                      <View style={styles.segmentedControl}>
                        <TouchableOpacity
                          style={[styles.segment, themePreference === 'light' && styles.segmentActive]}
                          onPress={() => setThemePreference('light')}
                        >
                          <Ionicons
                            name="sunny"
                            size={16}
                            color={themePreference === 'light' ? '#FFF' : theme.textSecondary}
                          />
                          <Text style={[styles.segmentText, themePreference === 'light' && styles.segmentTextActive]}>
                            Light
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.segment, themePreference === 'dark' && styles.segmentActive]}
                          onPress={() => setThemePreference('dark')}
                        >
                          <Ionicons
                            name="moon"
                            size={16}
                            color={themePreference === 'dark' ? '#FFF' : theme.textSecondary}
                          />
                          <Text style={[styles.segmentText, themePreference === 'dark' && styles.segmentTextActive]}>
                            Dark
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.segment, themePreference === 'system' && styles.segmentActive]}
                          onPress={() => setThemePreference('system')}
                        >
                          <Ionicons
                            name="settings-outline"
                            size={16}
                            color={themePreference === 'system' ? '#FFF' : theme.textSecondary}
                          />
                          <Text style={[styles.segmentText, themePreference === 'system' && styles.segmentTextActive]}>
                            Auto
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                </>
              )}


              {isCaregiver && (
                <>
                  <Text style={styles.sectionTitle}>Gallery & Sharing</Text>
                  <Card style={styles.card}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => setShowPhotoManagement(true)}
                    >
                      <Ionicons name="images-outline" size={24} color={theme.text} />
                      <Text style={styles.menuItemText}>Manage Library</Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => setShowHomePhotoDialog(true)}
                    >
                      <Ionicons name="home-outline" size={24} color={theme.text} />
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>Home Screen Hero</Text>
                        <Text style={styles.menuItemSubtext}>
                          {patient?.photo_url === 'random' || !patient?.photo_url ? 'Random' : 'Custom'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => setShowSupporterManagement(true)}
                    >
                      <Ionicons name="people-outline" size={24} color={theme.text} />
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>Friends & Family</Text>
                        <Text style={styles.menuItemSubtext}>Invite others to share memories</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                  </Card>

                  <Text style={styles.sectionTitle}>Session Options</Text>
                  <Card style={styles.card}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        if (patient?.id) {
                          updateSettings(patient.id, { voice_therapy_enabled: !settings?.voice_therapy_enabled });
                        }
                      }}
                    >
                      <Ionicons name="mic-outline" size={24} color={theme.text} />
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>Voice Assistant</Text>
                        <Text style={styles.menuItemSubtext}>Enable AI companion interaction</Text>
                      </View>
                      <View style={[styles.toggle, settings?.voice_therapy_enabled && styles.toggleActive]}>
                        <View style={[styles.toggleKnob, settings?.voice_therapy_enabled && styles.toggleKnobActive]} />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => router.push('/(caregiver)/schedule')}
                    >
                      <Ionicons name="calendar-outline" size={24} color={theme.text} />
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>Session Schedule</Text>
                        <Text style={styles.menuItemSubtext}>{scheduleSummary}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                  </Card>

                  <Text style={styles.sectionTitle}>Privacy & Security</Text>
                  <Card style={styles.card}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => setShowPinDialog(true)}
                    >
                      <Ionicons name="lock-closed-outline" size={24} color={theme.text} />
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>App Security PIN</Text>
                        <Text style={styles.menuItemSubtext}>
                          {settings?.settings_pin ? `PIN: ${settings.settings_pin}` : 'Protect settings access'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>

                    {settings?.settings_pin && (
                      <>
                        <View style={styles.divider} />
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => setShowRemovePinDialog(true)}
                        >
                          <Ionicons name="close-circle-outline" size={24} color={theme.danger} />
                          <Text style={[styles.menuItemText, styles.dangerText]}>
                            Remove PIN
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.menuItem} onPress={handleExportData}>
                      <Ionicons name="download-outline" size={24} color={theme.text} />
                      <Text style={styles.menuItemText}>Export All Data</Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                  </Card>
                </>
              )}

              <Text style={styles.sectionTitle}>Account</Text>
              <Card style={styles.card}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setShowLogoutDialog(true)}
                >
                  <Ionicons name="log-out-outline" size={24} color={theme.text} />
                  <Text style={styles.menuItemText}>Log Out</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>

                {isCaregiver && (
                  <>
                    <View style={styles.divider} />
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => setShowDeleteDialog(true)}
                    >
                      <Ionicons name="trash-outline" size={24} color={theme.danger} />
                      <Text style={[styles.menuItemText, styles.dangerText]}>
                        Delete Account
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                  </>
                )}
              </Card>

              <Text style={styles.versionText}>Reminisce v1.0.0</Text>
            </View>
          </ScrollView>

          <ConfirmationDialog
            visible={showLogoutDialog}
            title="Log Out"
            message="Are you sure you want to log out?"
            confirmText="Log Out"
            onConfirm={handleLogout}
            onCancel={() => setShowLogoutDialog(false)}
          />

          <ConfirmationDialog
            visible={showDeleteDialog}
            title="Delete Account"
            message="This will schedule your account for deletion in 30 days. All your data including photos will be permanently removed. This action can be cancelled by logging back in."
            confirmText="Delete Account"
            confirmVariant="danger"
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteDialog(false)}
          />

          <PinDialog
            visible={showPinDialog}
            title={settings?.settings_pin ? "Change PIN" : "Set PIN"}
            message={settings?.settings_pin ? "Enter a new 4-digit PIN" : "Create a 4-digit PIN to protect your settings"}
            onConfirm={handleUpdatePin}
            onCancel={() => {
              setShowPinDialog(false);
              setPinError(undefined);
            }}
            error={pinError}
          />

          <ConfirmationDialog
            visible={showRemovePinDialog}
            title="Remove PIN"
            message="Are you sure you want to remove the settings PIN?"
            confirmText="Remove"
            confirmVariant="danger"
            onConfirm={handleClearPin}
            onCancel={() => setShowRemovePinDialog(false)}
          />

          <PhotoManagementDialog
            visible={showPhotoManagement}
            onClose={() => setShowPhotoManagement(false)}
          />

          <EditPatientDialog
            visible={showEditProfile}
            patient={patient}
            onClose={() => setShowEditProfile(false)}
            onUpdate={(updated) => setPatient(updated)}
          />

          {patient && (
            <HomePhotoDialog
              visible={showHomePhotoDialog}
              onClose={() => setShowHomePhotoDialog(false)}
              patientId={patient.id}
              currentPhotoUrl={patient.photo_url}
              onUpdate={() => fetchPatient(patient.id)}
            />
          )}

          {patient && (
            <SupporterManagementDialog
              visible={showSupporterManagement}
              patientId={patient.id}
              onClose={() => setShowSupporterManagement(false)}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const getStyles = (theme: ThemeColors, contentPadding: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: contentPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center', // Center the contentWrapper
  },
  contentWrapper: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  header: {
    paddingBottom: spacing.md,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: spacing.xs,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -spacing.xs, // Offset padding for alignment
  },
  headerTitle: {
    ...typography.heading3,
    color: theme.text,
  },
  headerSpacer: {
    width: 44,
  },

  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    position: 'relative',
  },
  personalEditIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.text,
  },
  accountEmail: {
    ...typography.bodySmall,
    color: theme.textSecondary,
  },
  accountBirthday: {
    ...typography.caption,
    color: theme.textLight,
    marginTop: spacing.xs / 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  editIconContainer: {
    padding: spacing.xs,
  },
  themeSelector: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  themeSelectorLabel: {
    ...typography.bodySmall,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  segmentedControl: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: borderRadius.md,
    padding: 2,
    maxWidth: 240,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  segmentActive: {
    backgroundColor: theme.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segmentText: {
    ...typography.caption,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  menuItemText: {
    ...typography.body,
    color: theme.text,
    flex: 1,
  },
  menuItemSubtext: {
    ...typography.caption,
    color: theme.textSecondary,
  },
  menuItemContent: {
    flex: 1,
  },
  dangerText: {
    color: theme.danger,
  },
  versionText: {
    ...typography.caption,
    color: theme.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: theme.success,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
});

