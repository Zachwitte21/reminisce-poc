import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    RefreshControl,
    TouchableOpacity,
    Dimensions,
    useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/auth-store';
import { usePatientStore } from '../../src/stores/patient-store';
import { Button, Card } from '../../src/components/ui';
import type { ThemeColors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { useTheme } from '../../src/hooks/useTheme';
import { api } from '../../src/services/api';
import { AlertDialog, ConfirmationDialog } from '../../src/components/shared';
import { layout } from '../../src/theme/layout';

export default function SupporterDashboard() {
    const { width: windowWidth } = useWindowDimensions();
    const { user, logout, updateAvatar } = useAuthStore();
    const { patient, fetchPatient } = usePatientStore();
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const theme = useTheme();

    const isLargeScreen = windowWidth > layout.maxWidth;
    const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;
    const styles = getStyles(theme, contentPadding);

    const handleLogout = () => {
        setShowLogoutDialog(true);
    };

    const handleLogoutConfirm = () => {
        logout();
        router.replace('/(auth)/login');
    };

    useEffect(() => {
        fetchPatient().catch(err => console.error('[SupporterDashboard] fetchPatient failed:', err));
    }, [fetchPatient]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchPatient();
        } finally {
            setRefreshing(false);
        }
    };

    const handlePickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            try {
                const asset = result.assets[0];
                await updateAvatar({
                    uri: asset.uri,
                    type: 'image/jpeg',
                    fileName: asset.fileName || 'profile.jpg'
                });
            } catch (error) {
                console.error('[SupporterDashboard] Avatar upload failed:', error);
                alert('Failed to update profile photo.');
            } finally {
                setUploading(false);
            }
        }
    };

    const handlePickImage = async () => {
        if (!patient?.id) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            setUploading(true);
            try {
                const filesToUpload = result.assets.map(asset => ({
                    uri: asset.uri,
                    type: 'image/jpeg',
                    fileName: asset.fileName || `upload_${Date.now()}.jpg`
                }));

                await api.uploadMedia(patient.id, filesToUpload);
                setShowSuccessDialog(true);
            } catch (error) {
                console.error('[SupporterDashboard] Upload failed:', error);
                setShowErrorDialog(true);
            } finally {
                setUploading(false);
            }
        }
    };

    const name = user?.full_name?.split(' ')[0] || 'there';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.contentWrapper}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={handleLogout}
                    >
                        <MaterialCommunityIcons name="logout" size={24} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Family Supporter</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                    }
                >
                    <View style={styles.welcomeCard}>
                        <View style={styles.profileSection}>
                            <TouchableOpacity
                                style={styles.avatarContainer}
                                onPress={handlePickAvatar}
                                disabled={uploading}
                            >
                                {user?.avatar_url ? (
                                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.placeholderAvatar]}>
                                        <Ionicons name="person" size={40} color={theme.textLight} />
                                    </View>
                                )}
                                <View style={styles.editAvatarButton}>
                                    <Ionicons name="camera" size={16} color="white" />
                                </View>
                            </TouchableOpacity>
                            <View style={styles.welcomeText}>
                                <Text style={styles.greeting}>Hello {name}!</Text>
                                <Text style={styles.connectedTo}>
                                    Connected to {patient?.first_name}'s Reminisce
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Card style={styles.uploadCard}>
                        <View style={styles.uploadHeader}>
                            <Ionicons name="images" size={32} color={theme.primary} />
                            <Text style={styles.uploadTitle}>Share a Memory</Text>
                            <Text style={styles.uploadSubtitle}>
                                Upload photos to show {patient?.first_name} during their therapy sessions.
                            </Text>
                        </View>

                        <Button
                            title={uploading ? "Uploading..." : "Select Photos"}
                            onPress={handlePickImage}
                            loading={uploading}
                            icon={<Ionicons name="add-circle" size={24} color="#FFF" />}
                            style={styles.uploadButton}
                        />
                    </Card>

                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>What happens next?</Text>
                        <View style={styles.infoStep}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                            <Text style={styles.stepText}>Your photos are sent to the caregiver for approval.</Text>
                        </View>
                        <View style={styles.infoStep}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                            <Text style={styles.stepText}>Approved photos will appear in {patient?.first_name}'s reminiscence sessions.</Text>
                        </View>
                        <View style={styles.infoStep}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                            <Text style={styles.stepText}>AI voice assistant will help {patient?.first_name} talk about your shared memories.</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>

            <ConfirmationDialog
                visible={showLogoutDialog}
                title="Log Out"
                message="Are you sure you want to log out?"
                confirmText="Log Out"
                onConfirm={handleLogoutConfirm}
                onCancel={() => setShowLogoutDialog(false)}
            />

            <AlertDialog
                visible={showSuccessDialog}
                title="Photos Uploaded!"
                message={`Your photos have been sent to ${patient?.first_name}'s caregiver for review.`}
                buttonText="Great!"
                icon="checkmark-circle"
                iconColor={theme.success}
                onDismiss={() => setShowSuccessDialog(false)}
            />

            <AlertDialog
                visible={showErrorDialog}
                title="Upload Failed"
                message="Something went wrong while uploading your photos. Please check your connection and try again."
                buttonText="OK"
                icon="alert-circle"
                iconColor={theme.danger}
                onDismiss={() => setShowErrorDialog(false)}
            />
        </SafeAreaView>
    );
}

const getStyles = (theme: ThemeColors, contentPadding: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: layout.maxWidth,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        ...typography.heading3,
        color: theme.text,
    },
    settingsButton: {
        padding: spacing.xs,
    },
    scrollContent: {
        paddingHorizontal: contentPadding,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        gap: spacing.xl,
    },
    welcomeCard: {
        backgroundColor: theme.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: spacing.md,
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: theme.primary + '30',
    },
    placeholderAvatar: {
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    welcomeText: {
        flex: 1,
    },
    greeting: {
        ...typography.heading2,
        color: theme.text,
    },
    connectedTo: {
        ...typography.bodySmall,
        color: theme.textSecondary,
        marginTop: 2,
    },
    uploadCard: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    uploadHeader: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    uploadTitle: {
        ...typography.heading3,
        color: theme.text,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    uploadSubtitle: {
        ...typography.body,
        color: theme.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    uploadButton: {
        height: 56,
        paddingHorizontal: spacing.xl,
        borderRadius: 28,
    },
    infoSection: {
        marginTop: spacing.md,
    },
    sectionTitle: {
        ...typography.heading3,
        color: theme.text,
        marginBottom: spacing.lg,
    },
    infoStep: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumberText: {
        color: theme.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    stepText: {
        ...typography.body,
        color: theme.textSecondary,
        flex: 1,
    },
});
