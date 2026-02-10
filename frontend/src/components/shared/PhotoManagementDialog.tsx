import { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    FlatList,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../hooks/useTheme';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Button, Input, Badge } from '../ui';
import { ConfirmationDialog } from './ConfirmationDialog';
import { api } from '../../services/api';
import { usePatientStore } from '../../stores';
import { Media, Tag } from '../../types/api';
import { logger } from '../../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 800;
const MAX_IMAGE_WIDTH = 1920;
const COMPRESSION_QUALITY = 0.7;

interface PhotoManagementDialogProps {
    visible: boolean;
    onClose: () => void;
}

export function PhotoManagementDialog({ visible, onClose }: PhotoManagementDialogProps) {
    const theme = useTheme();
    const styles = getStyles(theme);
    const { patient, media, fetchMedia } = usePatientStore();

    const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [isAiTagging, setIsAiTagging] = useState(false);
    const [caption, setCaption] = useState('');
    const [dateTaken, setDateTaken] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [dateInput, setDateInput] = useState('');
    const [dateError, setDateError] = useState('');

    const contentWidth = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);
    const GRID_COLUMNS = 3;
    const GRID_GAP = spacing.xs;
    const gridItemSize = (contentWidth - spacing.sm * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

    const goToPrevious = () => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setCurrentIndex(newIndex);
            setSelectedMedia(media[newIndex]);
        }
    };

    const goToNext = () => {
        if (currentIndex < media.length - 1) {
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            setSelectedMedia(media[newIndex]);
        }
    };

    const handleSelectMedia = (item: Media) => {
        const index = media.findIndex(m => m.id === item.id);
        setCurrentIndex(index >= 0 ? index : 0);
        setSelectedMedia(item);
    };

    const handleBackToGrid = () => {
        setSelectedMedia(null);
    };

    useEffect(() => {
        if (visible && patient?.id) {
            fetchMedia(patient.id);
        }
    }, [visible, patient?.id]);

    const compressImage = async (uri: string): Promise<{ uri: string; fileSize?: number }> => {
        return ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: MAX_IMAGE_WIDTH } }],
            { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 1,
            exif: true,
        });

        if (result.canceled || result.assets.length === 0 || !patient?.id) return;

        setIsUploading(true);
        try {
            const files = await Promise.all(result.assets.map(async (asset, index) => {
                const compressed = await compressImage(asset.uri);
                const fileName = asset.fileName?.replace(/\.[^.]+$/, '.jpg') || `photo_${Date.now()}_${index}.jpg`;

                // Try to extract date from EXIF if available (native only)
                let dateTaken: string | undefined = undefined;
                if (asset.exif && asset.exif.DateTimeOriginal) {
                    // EXIF format usually "YYYY:MM:DD HH:MM:SS"
                    const match = asset.exif.DateTimeOriginal.match(/^(\d{4}):(\d{2}):(\d{2})/);
                    if (match) {
                        dateTaken = `${match[1]}-${match[2]}-${match[3]}`;
                    }
                }

                if (Platform.OS === 'web') {
                    const response = await fetch(compressed.uri);
                    const blob = await response.blob();
                    return {
                        file: new File([blob], fileName, { type: 'image/jpeg' }),
                        dateTaken
                    };
                }
                return {
                    file: { uri: compressed.uri, name: fileName, type: 'image/jpeg' } as unknown as File,
                    dateTaken
                };
            }));

            // Upload files
            const uploadResponse = await api.uploadMedia(patient.id, files.map(f => f.file));

            // If any files had EXIF dates, update them immediately
            if (uploadResponse.uploaded) {
                for (let i = 0; i < uploadResponse.uploaded.length; i++) {
                    const exifDate = files[i]?.dateTaken;
                    if (exifDate) {
                        await api.updateMedia(uploadResponse.uploaded[i].id, { date_taken: exifDate });
                    }
                }
            }

            await fetchMedia(patient.id);
            Alert.alert('Success', 'Photos uploaded successfully.');
        } catch (error) {
            const err = error as { response?: { data?: { detail?: { message?: string } } }; message?: string };
            const message = err?.response?.data?.detail?.message ||
                err?.message ||
                'Failed to upload photos. Images may be too large.';
            Alert.alert('Upload Error', message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddTag = async () => {
        if (!newTag.trim() || !selectedMedia || !patient?.id) {
            return;
        }

        setIsAddingTag(true);
        try {
            await api.addMediaTag(selectedMedia.id, 'custom', newTag.trim());
            await fetchMedia(patient.id);
            setNewTag('');
        } catch (error) {
            logger.error('[PhotoManagement] Failed to add tag:', error);
            Alert.alert('Error', 'Failed to add tag.');
        } finally {
            setIsAddingTag(false);
        }
    };

    const handleDeleteTag = async (tagId: string) => {
        if (!selectedMedia || !patient?.id) return;
        try {
            await api.deleteMediaTag(selectedMedia.id, tagId);
            await fetchMedia(patient.id);
        } catch {
            Alert.alert('Error', 'Failed to delete tag.');
        }
    };

    const handleAiTag = async () => {
        if (!currentMedia || !patient?.id) return;

        setIsAiTagging(true);
        try {
            const response = await api.aiTagMedia(currentMedia.id);
            const suggestions = response.suggestions as any;

            if (suggestions) {
                // Add tags from identified categories
                const newTags: string[] = [];
                if (Array.isArray(suggestions.people)) newTags.push(...suggestions.people);
                if (suggestions.setting) newTags.push(suggestions.setting);
                if (suggestions.mood) newTags.push(suggestions.mood);
                if (Array.isArray(suggestions.objects)) newTags.push(...suggestions.objects);

                for (const tagVal of newTags) {
                    if (tagVal && typeof tagVal === 'string') {
                        await api.addMediaTag(currentMedia.id, 'custom', tagVal.trim());
                    }
                }

                // If AI found a date and we don't have one, offer to set it
                if (suggestions.exact_date_estimate && !currentMedia.date_taken) {
                    // Try to parse YYYY-MM-DD from the estimate
                    const dateMatch = suggestions.exact_date_estimate.match(/\d{4}-\d{2}-\d{2}/);
                    if (dateMatch) {
                        await handleUpdateMedia({ date_taken: dateMatch[0] });
                    }
                }

                await fetchMedia(patient.id);
                Alert.alert('AI Analysis Complete', 'Successfully added relevant tags based on the image content.');
            } else {
                Alert.alert('No suggestions', 'AI could not find any clear tags for this photo.');
            }
        } catch {
            Alert.alert('Error', 'AI tagging failed.');
        } finally {
            setIsAiTagging(false);
        }
    };

    const currentMedia = selectedMedia
        ? media.find(m => m.id === selectedMedia.id) || selectedMedia
        : null;

    const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        if (currentMedia) {
            setCaption(currentMedia.caption || '');
            if (currentMedia.date_taken) {
                const [year, month, day] = currentMedia.date_taken.split('-').map(Number);
                // Create date in local timezone
                setDateTaken(new Date(year, month - 1, day));
                setDateInput(`${month}/${day}/${year}`);
            } else {
                setDateTaken(null);
                setDateInput('');
            }
            setDateError('');
        }
    }, [currentMedia?.id, currentMedia?.date_taken, currentMedia?.caption]);

    const handleDateInputBlur = () => {
        if (!dateInput.trim()) {
            setDateTaken(null);
            handleUpdateMedia({ date_taken: undefined } as any);
            setDateError('');
            return;
        }

        // Try to parse MM/DD/YYYY or YYYY-MM-DD
        let year, month, day;
        const slashMatch = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const dashMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (slashMatch) {
            month = parseInt(slashMatch[1], 10);
            day = parseInt(slashMatch[2], 10);
            year = parseInt(slashMatch[3], 10);
        } else if (dashMatch) {
            year = parseInt(dashMatch[1], 10);
            month = parseInt(dashMatch[2], 10);
            day = parseInt(dashMatch[3], 10);
        } else {
            setDateError('Use MM/DD/YYYY format');
            return;
        }

        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            setDateError('Invalid date');
            return;
        }

        setDateError('');
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setDateTaken(date);
        handleUpdateMedia({ date_taken: formattedDate });
    };

    const handleDateChange = (text: string) => {
        // If deleting, just update the state without auto-formatting
        if (text.length < dateInput.length) {
            setDateInput(text);
            return;
        }

        // Strip non-numeric characters
        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;

        if (cleaned.length > 4) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
        } else if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }

        setDateInput(formatted.slice(0, 10)); // Limit to MM/DD/YYYY
        if (dateError) setDateError('');
    };

    const handleUpdateMedia = async (updates: Partial<Media>) => {
        if (!currentMedia || !patient?.id) return;
        setIsUpdating(true);
        try {
            await api.updateMedia(currentMedia.id, updates);
            await fetchMedia(patient.id);
        } catch {
            Alert.alert('Error', 'Failed to update photo details.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!currentMedia || !patient?.id) return;
        setIsDeleting(true);
        try {
            await api.deleteMedia(currentMedia.id);
            await fetchMedia(patient.id);
            setSelectedMedia(null);
            setShowDeleteConfirm(false);
        } catch {
            Alert.alert('Error', 'Failed to delete photo.');
        } finally {
            setIsDeleting(false);
        }
    };

    function renderGridItem({ item }: { item: Media }) {
        return (
            <TouchableOpacity
                style={[styles.gridItem, { width: gridItemSize, height: gridItemSize }]}
                onPress={() => handleSelectMedia(item)}
                activeOpacity={0.8}
            >
                <Image
                    source={{ uri: item.url }}
                    style={{ width: gridItemSize, height: gridItemSize }}
                    resizeMode="cover"
                />
                {item.tags && item.tags.length > 0 && (
                    <View style={styles.gridItemBadge}>
                        <Text style={styles.gridItemBadgeText}>{item.tags.length}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    const detailImageHeight = SCREEN_HEIGHT * 0.45;

    const renderDetailImage = () => (
        <View style={[styles.mediaContainer, { width: contentWidth }]}>
            <Image
                source={{ uri: currentMedia!.url }}
                style={{ width: contentWidth, height: detailImageHeight }}
                resizeMode="contain"
            />
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={theme.textLight} />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Button
                title="Upload Photos"
                onPress={handlePickImage}
                style={styles.emptyButton}
            />
        </View>
    );

    const renderGridView = () => (
        <FlatList
            data={media}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            numColumns={GRID_COLUMNS}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
        />
    );

    const renderDetailView = () => {
        if (!currentMedia) return null;

        const isFirstPhoto = currentIndex === 0;
        const isLastPhoto = currentIndex === media.length - 1;

        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flexOne}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.swiperContainer}>
                        {renderDetailImage()}

                        {media.length > 1 && (
                            <>
                                <TouchableOpacity
                                    style={[styles.navArrow, styles.navArrowLeft]}
                                    onPress={goToPrevious}
                                    disabled={isFirstPhoto}
                                >
                                    <Ionicons
                                        name="chevron-back"
                                        size={32}
                                        color={isFirstPhoto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.navArrow, styles.navArrowRight]}
                                    onPress={goToNext}
                                    disabled={isLastPhoto}
                                >
                                    <Ionicons
                                        name="chevron-forward"
                                        size={32}
                                        color={isLastPhoto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'}
                                    />
                                </TouchableOpacity>
                            </>
                        )}

                        <View style={styles.photoCounter}>
                            <Text style={styles.photoCounterText}>
                                {currentIndex + 1} / {media.length}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailsContainer}>
                        {/* Caption Section */}
                        <Text style={styles.sectionTitle}>Caption</Text>
                        <Input
                            placeholder="Add a story or description..."
                            value={caption}
                            onChangeText={setCaption}
                            onBlur={() => {
                                if (caption !== (currentMedia.caption || '')) {
                                    handleUpdateMedia({ caption });
                                }
                            }}
                            multiline
                            numberOfLines={3}
                            containerStyle={styles.captionInput}
                        />

                        {/* Date Taken Section */}
                        <Text style={styles.sectionTitle}>Date Taken</Text>
                        <Input
                            placeholder="MM/DD/YYYY"
                            value={dateInput}
                            onChangeText={handleDateChange}
                            onBlur={handleDateInputBlur}
                            error={dateError}
                            keyboardType="number-pad"
                            maxLength={10}
                            containerStyle={styles.dateInput}
                        />

                        {/* Tags Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Tags</Text>
                            <Button
                                title="AI Auto-Tag"
                                onPress={handleAiTag}
                                loading={isAiTagging}
                                variant="ghost"
                                size="small"
                                style={styles.aiBtn}
                            />
                        </View>

                        <View style={styles.tagsCloud}>
                            {currentMedia.tags.map((tag: Tag) => (
                                <Badge
                                    key={tag.id}
                                    label={tag.tag_value}
                                    variant="primary"
                                    showClose
                                    onClose={() => handleDeleteTag(tag.id)}
                                    style={styles.tagBadge}
                                />
                            ))}
                            {currentMedia.tags.length === 0 && (
                                <Text style={styles.emptyTagsText}>No tags added yet</Text>
                            )}
                        </View>

                        <View style={styles.inputRow}>
                            <Input
                                placeholder="Add a tag..."
                                value={newTag}
                                onChangeText={setNewTag}
                                containerStyle={styles.tagInput}
                                onSubmitEditing={handleAddTag}
                            />
                            <Button
                                title="Add"
                                onPress={handleAddTag}
                                loading={isAddingTag}
                                variant="primary"
                                style={styles.addBtn}
                                size="small"
                            />
                        </View>

                        {/* Delete Section */}
                        <View style={styles.deleteSection}>
                            <Button
                                title="Delete Photo"
                                onPress={() => setShowDeleteConfirm(true)}
                                variant="ghost"
                                style={styles.deleteBtn}
                                size="small"
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    };

    const renderContent = () => {
        if (media.length === 0) {
            return renderEmptyState();
        }
        if (selectedMedia && currentMedia) {
            return renderDetailView();
        }
        return renderGridView();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <View style={styles.container}>
                <View style={styles.innerContainer}>
                    <View style={styles.header}>
                        {selectedMedia ? (
                            <>
                                <TouchableOpacity onPress={handleBackToGrid} style={styles.closeButton}>
                                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Photo Details</Text>
                                <View style={styles.headerSpacer} />
                            </>
                        ) : (
                            <>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Manage Photos</Text>
                                <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
                                    <Ionicons name="add" size={28} color={theme.primary} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {isUploading && (
                        <View style={styles.uploadingOverlay}>
                            <View style={styles.uploadingContent}>
                                <ActivityIndicator size="large" color={theme.primary} />
                                <Text style={styles.uploadingText}>Uploading photos...</Text>
                            </View>
                        </View>
                    )}

                    {renderContent()}
                </View>

                <ConfirmationDialog
                    visible={showDeleteConfirm}
                    title="Delete Photo"
                    message="Are you sure you want to delete this photo? This action cannot be undone."
                    confirmText="Delete"
                    confirmVariant="danger"
                    onConfirm={handleDeletePhoto}
                    onCancel={() => setShowDeleteConfirm(false)}
                    loading={isDeleting}
                />
            </View>
        </Modal>
    );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
    },
    innerContainer: {
        flex: 1,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
    },
    headerTitle: {
        ...typography.heading3,
        color: theme.text,
    },
    headerSpacer: {
        width: 28,
    },
    closeButton: {
        padding: spacing.xs,
    },
    flexOne: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    uploadingContent: {
        backgroundColor: theme.surface,
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        gap: spacing.md,
    },
    uploadingText: {
        ...typography.body,
        color: theme.text,
        fontWeight: '500',
    },
    swiperContainer: {
        height: SCREEN_HEIGHT * 0.45,
        backgroundColor: '#000',
        position: 'relative',
    },
    mediaContainer: {
        height: SCREEN_HEIGHT * 0.45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navArrow: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateY: -24 }],
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    navArrowLeft: {
        left: spacing.sm,
    },
    navArrowRight: {
        right: spacing.sm,
    },
    photoCounter: {
        position: 'absolute',
        bottom: spacing.md,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    photoCounterText: {
        ...typography.bodySmall,
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    detailsContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    sectionTitle: {
        ...typography.bodySmall,
        fontWeight: '700',
        color: theme.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    aiBtn: {
        marginTop: 0,
        minHeight: 30,
    },
    tagsCloud: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.xl,
    },
    tagBadge: {
        marginBottom: spacing.xs,
    },
    emptyTagsText: {
        ...typography.body,
        color: theme.textLight,
        fontStyle: 'italic',
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
    },
    tagInput: {
        flex: 1,
    },
    addBtn: {
        marginTop: 0,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    emptyText: {
        ...typography.body,
        color: theme.textSecondary,
    },
    emptyButton: {
        minWidth: 200,
    },
    gridContainer: {
        padding: spacing.sm,
    },
    gridRow: {
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    gridItem: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        backgroundColor: theme.surface,
    },
    gridItemBadge: {
        position: 'absolute',
        bottom: spacing.xs,
        right: spacing.xs,
        backgroundColor: theme.primary,
        borderRadius: borderRadius.full,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    gridItemBadgeText: {
        ...typography.caption,
        color: '#fff',
        fontWeight: '600',
        fontSize: 11,
    },
    captionInput: {
        marginBottom: spacing.lg,
    },
    dateInput: {
        marginBottom: spacing.xl,
    },
    deleteSection: {
        marginTop: spacing.xl,
        paddingTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: theme.borderLight,
        alignItems: 'center',
    },
    deleteBtn: {
        borderColor: theme.danger,
    },
});
