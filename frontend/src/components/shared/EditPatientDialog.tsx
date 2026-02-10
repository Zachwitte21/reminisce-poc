import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../services/api';
import { Patient } from '../../types/api';
import { useAuthStore } from '../../stores';
import { Button, Input } from '../../components/ui';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';
import { formatBirthdayInput, birthdayToISO, isoToBirthday } from '../../utils/date';

interface EditPatientDialogProps {
    visible: boolean;
    onClose: () => void;
    patient: Patient | null;
    onUpdate: (updatedPatient: Patient) => void;
}

export function EditPatientDialog({
    visible,
    onClose,
    patient,
    onUpdate,
}: EditPatientDialogProps) {
    const theme = useTheme();
    const styles = getStyles(theme);
    const { user, updateAvatar } = useAuthStore();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [relationship, setRelationship] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (patient) {
            setFirstName(patient.first_name);
            setLastName(patient.last_name || '');
            setBirthDate(patient.birth_date ? isoToBirthday(patient.birth_date) : '');
            setSelectedImage(null);
            setErrors({});
        }
    }, [patient, visible]);

    const formatBirthday = (text: string) => formatBirthdayInput(text);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!relationship.trim()) {
            newErrors.relationship = 'Relationship is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const handleSave = async () => {
        if (!patient || !validate()) return;

        setIsLoading(true);
        try {
            // 1. Update text fields
            const updatedPatient = await api.updatePatient(patient.id, {
                first_name: firstName,
                last_name: lastName || undefined,
                birth_date: birthDate ? birthdayToISO(birthDate) : undefined,
                relationship,
            });

            // 2. Update avatar if changed (goes to profiles.avatar_url)
            if (selectedImage) {
                await updateAvatar({
                    uri: selectedImage.uri,
                    type: selectedImage.type || 'image/jpeg',
                    fileName: selectedImage.fileName,
                });
            }

            onUpdate(updatedPatient);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.overlay}>
                    <View style={styles.dialog}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Edit Profile</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.content}>
                            <View style={styles.avatarContainer}>
                                <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
                                    {selectedImage ? (
                                        <Image source={{ uri: selectedImage.uri }} style={styles.avatar} />
                                    ) : user?.avatar_url ? (
                                        <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.placeholderAvatar}>
                                            <Ionicons name="camera-outline" size={32} color={theme.textLight} />
                                        </View>
                                    )}
                                    <View style={styles.editIconContainer}>
                                        <Ionicons name="pencil" size={12} color="white" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <Input
                                label="First Name"
                                value={firstName}
                                onChangeText={setFirstName}
                                error={errors.firstName}
                            />

                            <Input
                                label="Last Name"
                                value={lastName}
                                onChangeText={setLastName}
                            />

                            <Input
                                label="Birthday"
                                value={birthDate}
                                onChangeText={(text) => setBirthDate(formatBirthday(text))}
                                placeholder="MM / DD / YYYY"
                                keyboardType="number-pad"
                                error={errors.birthDate}
                            />

                            <Input
                                label="Relationship"
                                value={relationship}
                                onChangeText={setRelationship}
                                error={errors.relationship}
                            />
                        </ScrollView>

                        <View style={styles.footer}>
                            <Button
                                title="Cancel"
                                variant="secondary"
                                onPress={onClose}
                                style={styles.button}
                            />
                            <Button
                                title="Save Changes"
                                onPress={handleSave}
                                loading={isLoading}
                                style={styles.button}
                            />
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    dialog: {
        backgroundColor: theme.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '90%',
        width: '100%',
        maxWidth: 800,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.heading3,
        color: theme.text,
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        gap: spacing.md,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarButton: {
        position: 'relative',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.background,
    },
    placeholderAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.primary,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.surface,
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    button: {
        flex: 1,
    },
});
