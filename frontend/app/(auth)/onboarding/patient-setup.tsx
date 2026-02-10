import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card } from '../../../src/components/ui';
import { typography } from '../../../src/theme/typography';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import { api } from '../../../src/services/api';
import { formatBirthdayInput, birthdayToISO } from '../../../src/utils/date';
import { useTheme } from '../../../src/hooks/useTheme';
import { ThemeColors } from '../../../src/theme/colors';

const MAX_WIDTH = 540;

export default function PatientSetupScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLargeScreen = windowWidth > MAX_WIDTH;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName) {
      newErrors.firstName = 'First name is required';
    }

    if (!relationship) {
      newErrors.relationship = 'Please specify your relationship';
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

  const handleContinue = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const patient = await api.createPatient({
        first_name: firstName,
        last_name: lastName || undefined,
        relationship,
        birth_date: birthDate ? birthdayToISO(birthDate) : undefined,
      });

      if (selectedImage) {
        await api.uploadPatientPhoto(patient.id, {
          uri: selectedImage.uri,
          type: selectedImage.type || 'image/jpeg',
          fileName: selectedImage.fileName,
        });
      }

      router.replace('/(auth)/onboarding/schedule-setup');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create patient profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: contentPadding }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrapper}>
            <View style={styles.header}>
              <Text style={styles.title}>Patient Profile</Text>
              <Text style={styles.subtitle}>Tell us about the person you're caring for</Text>
            </View>

            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage.uri }} style={styles.avatar} />
              ) : (
                <View style={styles.placeholderAvatar}>
                  <Ionicons name="camera" size={32} color={theme.textLight} />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Input
                    label="First Name"
                    placeholder="e.g. Mary"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    error={errors.firstName}
                  />
                </View>
                <View style={styles.flex1}>
                  <Input
                    label="Last Name"
                    placeholder="Optional"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Input
                label="Relationship"
                placeholder="e.g. She is my Mother"
                value={relationship}
                onChangeText={setRelationship}
                autoCapitalize="words"
                error={errors.relationship}
              />

              <Input
                label="Birthday"
                placeholder="MM / DD / YYYY"
                value={birthDate}
                onChangeText={(text) => setBirthDate(formatBirthdayInput(text))}
                keyboardType="numeric"
                maxLength={14}
              />

              <Button
                title="Continue"
                onPress={handleContinue}
                loading={isLoading}
                fullWidth
                style={styles.button}
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.heading1,
    color: theme.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  addPhotoText: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: 4,
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
    borderColor: 'white',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  button: {
    marginTop: spacing.md,
  },
});
