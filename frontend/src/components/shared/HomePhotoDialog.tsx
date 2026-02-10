import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    FlatList,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';
import { Media } from '../../types/api';
import { logger } from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const DIALOG_MAX_WIDTH = 500;
const GRID_PADDING = spacing.md;
const NUM_COLUMNS = 3;
const ITEM_GAP = 4;

interface HomePhotoDialogProps {
    visible: boolean;
    onClose: () => void;
    patientId: string;
    currentPhotoUrl?: string;
    onUpdate: () => void;
}

export function HomePhotoDialog({ visible, onClose, patientId, currentPhotoUrl, onUpdate }: HomePhotoDialogProps) {
    const [loading, setLoading] = useState(false);
    const [galleryImages, setGalleryImages] = useState<Media[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null); // 'random' or media.id
    const theme = useTheme();
    const styles = getStyles(theme);

    // Calculate item size based on dialog width
    const dialogWidth = Math.min(screenWidth - spacing.lg * 2, DIALOG_MAX_WIDTH);
    const gridWidth = dialogWidth - GRID_PADDING * 2;
    const itemSize = (gridWidth - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

    useEffect(() => {
        if (visible) {
            loadGallery();
            // Determine current selection
            if (!currentPhotoUrl || currentPhotoUrl === 'random') {
                setSelectedId('random');
            } else {
                // Find matching media by storage_path - we'll set it after loading
                setSelectedId(null);
            }
        }
    }, [visible, patientId]);

    const loadGallery = async () => {
        setLoading(true);
        try {
            const media = await api.getPatientMedia(patientId);
            const images = media.filter(m => m.type === 'photo');
            setGalleryImages(images);

            if (currentPhotoUrl && currentPhotoUrl !== 'random') {
                const match = images.find(m => m.storage_path === currentPhotoUrl || m.url === currentPhotoUrl);
                if (match) {
                    setSelectedId(match.id);
                }
            }
        } catch (error) {
            logger.error('[HomePhotoDialog] Failed to load gallery', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (id: string, storagePath?: string) => {
        setLoading(true);
        try {
            if (id === 'random') {
                await api.updatePatient(patientId, { photo_url: 'random' });
            } else {
                await api.updatePatient(patientId, { photo_url: storagePath });
            }
            setSelectedId(id);
            onUpdate();
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to update home photo');
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item, index }: { item: Media | { id: 'random' }; index: number }) => {
        const isRandom = item.id === 'random';
        const isSelected = selectedId === item.id;

        return (
            <TouchableOpacity
                style={[
                    styles.gridItem,
                    { width: itemSize, height: itemSize },
                    isSelected && styles.selectedItem,
                ]}
                onPress={() => handleSelect(item.id, isRandom ? undefined : (item as Media).storage_path)}
                disabled={loading}
            >
                {isRandom ? (
                    <View style={[styles.randomOption, { width: itemSize, height: itemSize }]}>
                        <Ionicons name="shuffle" size={32} color={isSelected ? theme.primary : theme.textLight} />
                        <Text style={[styles.randomText, isSelected && { color: theme.primary }]}>Random</Text>
                    </View>
                ) : (
                    <Image
                        source={{ uri: (item as Media).thumbnail_url || (item as Media).url }}
                        style={styles.thumbnail}
                    />
                )}
                {isSelected && (
                    <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // Prepend "Random" option to the gallery
    const gridData: (Media | { id: 'random' })[] = [{ id: 'random' }, ...galleryImages];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.dialog, { width: dialogWidth }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Home Screen Photo</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Tap to select what displays on the home screen.
                    </Text>

                    {loading && galleryImages.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={gridData}
                            numColumns={NUM_COLUMNS}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.gridContainer}
                            columnWrapperStyle={styles.row}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No approved photos yet.</Text>
                            }
                        />
                    )}

                    {loading && galleryImages.length > 0 && (
                        <View style={styles.savingOverlay}>
                            <ActivityIndicator size="small" color={theme.background} />
                            <Text style={styles.savingText}>Saving...</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    dialog: {
        backgroundColor: theme.background,
        borderRadius: borderRadius.lg,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingBottom: 0,
    },
    title: {
        ...typography.heading3,
        color: theme.text,
    },
    closeButton: {
        padding: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: theme.textLight,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xs,
        paddingBottom: spacing.md,
    },
    loadingContainer: {
        padding: spacing.xl * 2,
        alignItems: 'center',
    },
    gridContainer: {
        padding: GRID_PADDING,
        paddingTop: 0,
    },
    row: {
        gap: ITEM_GAP,
        marginBottom: ITEM_GAP,
    },
    gridItem: {
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        backgroundColor: theme.surface,
        position: 'relative',
    },
    selectedItem: {
        borderWidth: 3,
        borderColor: theme.primary,
    },
    randomOption: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.borderLight + '30',
        gap: spacing.xs,
    },
    randomText: {
        ...typography.caption,
        color: theme.textLight,
        fontWeight: '600',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    checkmark: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: theme.background,
        borderRadius: 12,
    },
    emptyText: {
        textAlign: 'center',
        color: theme.textLight,
        padding: spacing.xl,
    },
    savingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
    },
    savingText: {
        color: '#fff',
        ...typography.body,
    },
});
