import { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { Button } from '../ui/Button';

interface PinDialogProps {
    visible: boolean;
    title?: string;
    message?: string;
    onConfirm: (pin: string) => void;
    onCancel: () => void;
    error?: string;
}

export function PinDialog({
    visible,
    title = 'Enter PIN',
    message = 'Please enter your 4-digit PIN to continue',
    onConfirm,
    onCancel,
    error: initialError,
}: PinDialogProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(initialError);
    const theme = useTheme();
    const styles = getStyles(theme);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (visible) {
            setPin('');
            setError(initialError);
            // Small timeout to ensure modal is visible before focusing
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [visible, initialError]);

    const handlePinChange = (text: string) => {
        const numericText = text.replace(/[^0-9]/g, '');
        setPin(numericText);
        if (error) setError(undefined);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={() => {
                Keyboard.dismiss();
                onCancel();
            }}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.dialog}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>

                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={() => inputRef.current?.focus()}
                                style={styles.pinContainer}
                            >
                                {[0, 1, 2, 3].map((index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.pinBox,
                                            pin.length === index && styles.pinBoxFocused,
                                            error ? styles.pinBoxError : null,
                                        ]}
                                    >
                                        <Text style={styles.pinText}>
                                            {pin[index] ? '●' : ''}
                                        </Text>
                                    </View>
                                ))}
                            </TouchableOpacity>

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <TextInput
                                ref={inputRef}
                                value={pin}
                                onChangeText={handlePinChange}
                                keyboardType="number-pad"
                                maxLength={4}
                                style={styles.hiddenInput}
                                autoFocus={visible}
                                caretHidden
                            />

                            <View style={styles.buttons}>
                                <Button
                                    title="Confirm"
                                    onPress={() => onConfirm(pin)}
                                    disabled={pin.length < 4}
                                    style={styles.button}
                                />
                                <TouchableOpacity
                                    onPress={onCancel}
                                    style={styles.cancelButton}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
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
        backgroundColor: theme.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    title: {
        ...typography.heading3,
        color: theme.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    message: {
        ...typography.bodySmall,
        color: theme.textSecondary,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    pinContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    pinBox: {
        width: 50,
        height: 60,
        borderRadius: borderRadius.md,
        borderWidth: 2,
        borderColor: theme.border,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pinBoxFocused: {
        borderColor: theme.primary,
    },
    pinBoxError: {
        borderColor: theme.danger,
    },
    pinText: {
        ...typography.heading2,
        color: theme.text,
    },
    hiddenInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
    },
    errorText: {
        ...typography.caption,
        color: theme.danger,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    buttons: {
        width: '100%',
        marginTop: spacing.md,
    },
    button: {
        width: '100%',
    },
    cancelButton: {
        width: '100%',
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        ...typography.body,
        color: theme.textSecondary,
    },
});
