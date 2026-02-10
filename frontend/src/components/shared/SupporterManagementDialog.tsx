import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Supporter } from '../../types/api';
import { Button, Card } from '../ui';
import { useTheme } from '../../hooks/useTheme';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface SupporterManagementDialogProps {
    visible: boolean;
    onClose: () => void;
    patientId: string;
}

export const SupporterManagementDialog: React.FC<SupporterManagementDialogProps> = ({
    visible,
    onClose,
    patientId,
}) => {
    const [supporters, setSupporters] = useState<Supporter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const theme = useTheme();
    const styles = getStyles(theme);

    const fetchSupporters = async () => {
        setIsLoading(true);
        try {
            const data = await api.getSupporters(patientId);
            setSupporters(data);
        } catch (error) {
            console.error('[SupporterManagement] Fetch failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (visible && patientId) {
            fetchSupporters();
        }
    }, [visible, patientId]);

    const handleInvite = async () => {
        if (!inviteEmail || !inviteEmail.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setIsInviting(true);
        try {
            await api.sendInvitation(patientId, inviteEmail);
            Alert.alert('Success', `Invitation sent to ${inviteEmail}.`);
            setInviteEmail('');
            // Refresh to show any changes if needed (though invitations aren't supporters yet)
        } catch (error) {
            console.error('[SupporterManagement] Invite failed:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send invitation.');
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemove = (supporter: Supporter) => {
        Alert.alert(
            'Remove Supporter',
            `Are you sure you want to remove ${supporter.supporter_name || 'this supporter'}? They will no longer be able to upload photos.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.removeSupporter(patientId, supporter.supporter_id);
                            setSupporters(supporters.filter(s => s.id !== supporter.id));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove supporter.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Family & Friends</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.sectionTitle}>Invite Support</Text>
                        <Card style={styles.inviteCard}>
                            <Text style={styles.inviteDescription}>
                                Invite family and friends to contribute photos for therapy sessions.
                            </Text>
                            <View style={styles.inviteInputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="email@example.com"
                                    placeholderTextColor={theme.textLight}
                                    value={inviteEmail}
                                    onChangeText={setInviteEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                                <Button
                                    title="Invite"
                                    onPress={handleInvite}
                                    loading={isInviting}
                                    disabled={!inviteEmail}
                                    style={styles.inviteButton}
                                />
                            </View>
                        </Card>

                        <Text style={styles.sectionTitle}>Current Supporters</Text>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
                        ) : supporters.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color={theme.textLight + '40'} />
                                <Text style={styles.emptyStateText}>No supporters added yet.</Text>
                            </View>
                        ) : (
                            supporters.map((supporter) => (
                                <View key={supporter.id} style={styles.supporterItem}>
                                    <View style={styles.supporterInfo}>
                                        <Text style={styles.supporterName}>{supporter.supporter_name || 'Unknown'}</Text>
                                        <Text style={styles.supporterEmail}>{supporter.supporter_email || ''}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemove(supporter)}
                                        style={styles.removeButton}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: theme.overlay,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: theme.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        height: '80%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
    },
    title: {
        ...typography.heading3,
        color: theme.text,
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    sectionTitle: {
        ...typography.bodySmall,
        fontWeight: '700',
        color: theme.textSecondary,
        textTransform: 'uppercase',
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    inviteCard: {
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    inviteDescription: {
        ...typography.bodySmall,
        color: theme.textSecondary,
        marginBottom: spacing.md,
    },
    inviteInputContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        height: 48,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        color: theme.text,
        backgroundColor: theme.surface,
    },
    inviteButton: {
        height: 48,
        minWidth: 80,
    },
    loader: {
        marginVertical: spacing.xl,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: theme.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.border,
    },
    emptyStateText: {
        ...typography.body,
        color: theme.textLight,
        marginTop: spacing.sm,
    },
    supporterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: theme.surface,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: theme.borderLight,
    },
    supporterInfo: {
        flex: 1,
    },
    supporterName: {
        ...typography.body,
        fontWeight: '600',
        color: theme.text,
    },
    supporterEmail: {
        ...typography.caption,
        color: theme.textSecondary,
    },
    removeButton: {
        padding: spacing.sm,
    },
});
