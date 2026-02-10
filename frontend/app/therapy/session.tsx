import { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Alert,
    Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTherapyStore } from '../../src/stores/therapy-store';
import { usePatientStore } from '../../src/stores/patient-store';
import { useTheme } from '../../src/hooks/useTheme';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { ProgressDots } from '../../src/components/therapy/ProgressDots';
import { useVoiceSession } from '../../src/hooks/useVoiceSession';
import { logger } from '../../src/utils/logger';

export default function TherapySession() {
    const router = useRouter();
    const theme = useTheme();
    const {
        mediaQueue,
        currentIndex,
        nextPhoto,
        previousPhoto,
        endSession,
        currentSession,
        startSession
    } = useTherapyStore();

    const { patient, settings, fetchPatient } = usePatientStore();
    const [isInternalStarting, setIsInternalStarting] = useState(false);
    const [showEndModal, setShowEndModal] = useState(false);
    const hasAttemptedStart = useRef(false);
    const currentPhoto = mediaQueue[currentIndex];

    const buildPhotoContext = (photo: typeof currentPhoto) => {
        if (!photo) return undefined;
        return {
            id: photo.id,
            caption: photo.caption,
            tags: photo.tags?.map(t => ({ tag_type: t.tag_type, tag_value: t.tag_value })),
            date_taken: photo.date_taken
        };
    };

    const {
        connect,
        disconnect,
        sendPhotoChange,
        toggleListening,
        state: voiceState,
        isConnected: isVoiceConnected,
        isListening,
    } = useVoiceSession({
        sessionId: currentSession?.id || '',
        patientId: patient?.id || '',
        initialPhoto: buildPhotoContext(mediaQueue[0])
    });

    useEffect(() => {
        let mounted = true;
        if (currentSession && settings?.voice_therapy_enabled && voiceState === 'disconnected' && mounted) {
            connect();
        }
        return () => { mounted = false; };
    }, [currentSession, settings?.voice_therapy_enabled]);

    // Auto-start microphone when voice connects for hands-free conversation
    useEffect(() => {
        if (isVoiceConnected && !isListening && voiceState === 'connected') {
            toggleListening();
        }
    }, [isVoiceConnected, isListening, voiceState, toggleListening]);

    useEffect(() => {
        const photo = mediaQueue[currentIndex];
        if (isVoiceConnected && photo) {
            sendPhotoChange(buildPhotoContext(photo)!);
        }
    }, [currentIndex, isVoiceConnected, sendPhotoChange, mediaQueue]);

    useEffect(() => {
        if (!patient) {
            logger.info("[TherapySession] No patient in store, fetching...");
            fetchPatient().catch(err => logger.error("[TherapySession] Patient fetch failed", err));
        }
    }, [patient]);

    useEffect(() => {
        const initSession = async () => {
            if (patient && !currentSession && !hasAttemptedStart.current) {
                hasAttemptedStart.current = true;
                setIsInternalStarting(true);
                try {
                    const startTime = Date.now();
                    await startSession(patient.id, true);

                    const state = useTherapyStore.getState();
                    const firstPhotoUrl = state.mediaQueue[0]?.url;
                    if (firstPhotoUrl) {
                        try { await Image.prefetch(firstPhotoUrl); } catch { }
                    }

                    const elapsed = Date.now() - startTime;
                    if (elapsed < 2000) {
                        await new Promise(resolve => setTimeout(resolve, 2000 - elapsed));
                    }
                } catch (error) {
                    logger.error("[TherapySession] Failed to start session:", error);
                    Alert.alert("Error", "Failed to start session. Please try again.");
                    router.replace('/(caregiver)');
                } finally {
                    setIsInternalStarting(false);
                }
            }
        };

        initSession();
    }, [patient, currentSession]);

    useEffect(() => {
        if (currentIndex < mediaQueue.length - 1) {
            const nextUrl = mediaQueue[currentIndex + 1]?.url;
            if (nextUrl) {
                Image.prefetch(nextUrl);
            }
        }
    }, [currentIndex, mediaQueue]);

    const handleNext = () => {
        if (currentIndex === mediaQueue.length - 1) {
            setShowEndModal(true);
        } else {
            nextPhoto();
        }
    };

    const handleFinish = async () => {
        await endSession(true);
        router.replace('/(caregiver)');
    };

    if (isInternalStarting || (!currentSession && patient)) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.primary }]}>
                <Image
                    source={require('../../assets/images/drawn-reminisce-pinwheels-removebg-preview.png')}
                    style={styles.loadingLogo}
                    resizeMode="contain"
                />
                <Text style={[styles.loadingQuote, { color: theme.textInverse }]}>
                    "Memory is the diary that we all carry about with us"
                </Text>
                <Text style={[styles.loadingAttribution, { color: theme.textInverse + 'A0' }]}>
                    -Oscar Wilde
                </Text>
                <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 40 }} />
            </View>
        );
    }

    if (currentSession && mediaQueue.length === 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
                <Ionicons name="images-outline" size={80} color={theme.textLight} />
                <Text style={[styles.modalTitle, { color: theme.text, marginTop: 20 }]}>No Memories Found</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: 'center', marginBottom: 40 }]}>
                    Please add and approve some photos in the gallery before starting a session.
                </Text>
                <TouchableOpacity
                    style={[styles.homeButton, { backgroundColor: theme.primary }]}
                    onPress={() => router.replace('/(caregiver)')}
                >
                    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600' }}>Back to Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (!currentPhoto) return null;

    return (
        <View style={styles.outerContainer}>
            {currentPhoto?.url && (
                <>
                    <Animated.Image
                        key={`bg-${currentPhoto.id}`}
                        source={{ uri: currentPhoto.url }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        blurRadius={Platform.OS === 'ios' ? 20 : 10}
                    />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
                </>
            )}

            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={styles.photoContainer}>
                    {/* Preload Previous Photo */}
                    {currentIndex > 0 && (
                        <Image
                            source={{ uri: mediaQueue[currentIndex - 1].url }}
                            style={styles.hiddenPreload}
                        />
                    )}

                    <Animated.Image
                        key={currentPhoto.id} // Key triggers animation on photo change
                        source={{ uri: currentPhoto.url }}
                        style={styles.image}
                        resizeMode="cover"
                        entering={FadeIn.duration(400)}
                        exiting={FadeOut.duration(300)}
                    />

                    {/* Preload Next Photo */}
                    {currentIndex < mediaQueue.length - 1 && (
                        <Image
                            source={{ uri: mediaQueue[currentIndex + 1].url }}
                            style={styles.hiddenPreload}
                        />
                    )}

                    {/* Gradient overlays for better readability */}
                    <LinearGradient
                        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
                        style={[styles.gradientOverlay, { top: 0, height: '30%' }]}
                        pointerEvents="none"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
                        style={[styles.gradientOverlay, { bottom: 0, height: '30%' }]}
                        pointerEvents="none"
                    />
                </View>



                {/* Progress & Controls */}
                <SafeAreaView style={styles.controls} pointerEvents="box-none">
                    <ProgressDots
                        total={mediaQueue.length}
                        current={currentIndex}
                    />

                    <View style={styles.buttonBarContainer}>
                        <View style={styles.buttonBar}>
                            {settings?.voice_therapy_enabled && (
                                <TouchableOpacity
                                    style={[
                                        styles.voiceToggleButton,
                                        { backgroundColor: isVoiceConnected ? 'rgba(255,255,255,0.15)' : theme.danger },
                                    ]}
                                    onPress={() => isVoiceConnected ? disconnect() : connect()}
                                    disabled={voiceState === 'connecting'}
                                    accessibilityLabel={isVoiceConnected ? 'Turn off AI voice' : 'Turn on AI voice'}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    {voiceState === 'connecting' ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Ionicons
                                            name={isVoiceConnected ? 'volume-medium-outline' : 'volume-mute-outline'}
                                            size={24}
                                            color="#FFFFFF"
                                        />
                                    )}
                                </TouchableOpacity>
                            )}

                            {currentIndex > 0 && (
                                <TouchableOpacity
                                    style={[styles.navButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                                    onPress={previousPhoto}
                                >
                                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Back</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.navButton, { backgroundColor: theme.primary }]}
                                onPress={handleNext}
                            >
                                <Text style={[styles.buttonText, { color: theme.textInverse }]}>
                                    {currentIndex === mediaQueue.length - 1 ? 'Finish' : 'Next'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>

                {/* End Session Modal */}
                {showEndModal && (
                    <Animated.View
                        style={styles.modalOverlay}
                        entering={FadeIn.duration(250)}
                        exiting={FadeOut.duration(200)}
                    >
                        {/* Use theme for background to keep it dynamic */}
                        <Animated.View
                            style={[styles.modalBox, { backgroundColor: theme.primary }]}
                            entering={SlideInDown.springify().damping(20).stiffness(90)}
                            exiting={FadeOut.duration(200)}
                        >
                            <Text style={[styles.modalTitle, { color: theme.textInverse }]}>
                                Session Complete
                            </Text>

                            <View style={styles.modalActions}>
                                <Animated.View
                                    entering={FadeIn.delay(300).duration(300)}
                                    style={{ flex: 1 }}
                                >
                                    <TouchableOpacity
                                        style={styles.modalSecondaryButton}
                                        onPress={() => setShowEndModal(false)}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="arrow-back" size={24} color={theme.textInverse} />
                                        <Text style={[styles.modalSecondaryButtonText, { color: theme.textInverse }]}>
                                            Back
                                        </Text>
                                    </TouchableOpacity>
                                </Animated.View>

                                <Animated.View
                                    entering={FadeIn.delay(400).duration(300)}
                                    style={{ flex: 1 }}
                                >
                                    <TouchableOpacity
                                        style={styles.homeButton}
                                        onPress={handleFinish}
                                        activeOpacity={0.9}
                                    >
                                        <Ionicons name="home" size={24} color={theme.primary} />
                                        <Text style={[styles.homeButtonText, { color: theme.primary }]}>
                                            Home
                                        </Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                        </Animated.View>
                    </Animated.View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        width: '100%',
        maxWidth: 800,
        overflow: 'hidden',
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
    photoContainer: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#000',
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    hiddenPreload: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: spacing.xs,
    },
    buttonBarContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    buttonBar: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: borderRadius.full,
        padding: 8,
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
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            },
        }),
    },
    voiceToggleButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navButton: {
        flex: 1,
        height: 56,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    buttonText: {
        ...typography.heading3,
        fontSize: 22,
        fontWeight: '700',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        zIndex: 100,
    },
    modalBox: {
        padding: spacing.xxl,
        borderRadius: 32,
        alignItems: 'center',
        width: '100%',
    },
    modalTitle: {
        ...typography.heading1,
        fontSize: 32,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        fontSize: 18,
    },
    homeButton: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 40,
        gap: spacing.sm,
        flex: 1,
        justifyContent: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    modalSecondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 40,
        gap: spacing.sm,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        flex: 1,
        justifyContent: 'center',
    },
    modalSecondaryButtonText: {
        ...typography.button,
        fontSize: 20,
        color: '#FFFFFF',
    },
    homeButtonText: {
        ...typography.button,
        fontSize: 20,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingLogo: {
        width: 250,
        height: 250,
        marginBottom: spacing.lg,
    },
    loadingQuote: {
        ...typography.body,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
        marginTop: spacing.md,
    },
    loadingAttribution: {
        ...typography.bodySmall,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
});
