import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Input, Card } from '../../src/components/ui';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { useTheme } from '../../src/hooks/useTheme';
import { ThemeColors } from '../../src/theme/colors';

const MAX_WIDTH = 480;

export default function RegisterScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [supportCode, setSupportCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { register, acceptInvite, isLoading } = useAuthStore();

  const isLargeScreen = windowWidth > MAX_WIDTH;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName || fullName.length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      if (supportCode) {
        await acceptInvite(supportCode, { email, password, full_name: fullName });
        router.replace('/(supporter)');
      } else {
        await register({ email, password, full_name: fullName, role: 'caregiver' });
        router.replace('/(auth)/onboarding/patient-setup');
      }
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Could not create account');
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                {supportCode ? 'Join as a supporter' : 'Join Reminisce as a caregiver'}
              </Text>
            </View>

            <Card style={styles.card}>
              <Input
                label="Full Name"
                placeholder="Enter your name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                error={errors.fullName}
              />

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
              />

              <Input
                label="Password"
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                error={errors.confirmPassword}
              />

              <View style={styles.divider} />

              <Input
                label="Support Code (Optional)"
                placeholder="Enter 8-digit code if invited"
                value={supportCode}
                onChangeText={setSupportCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />

              <Text style={styles.requirements}>
                Password must be at least 8 characters
              </Text>

              <Button
                title="Create Account"
                onPress={handleRegister}
                loading={isLoading}
                fullWidth
                style={styles.registerButton}
              />
            </Card>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  title: {
    ...typography.heading1,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: theme.textSecondary,
  },
  card: {
    marginBottom: spacing.lg,
  },
  requirements: {
    ...typography.caption,
    color: theme.textLight,
    marginBottom: spacing.md,
  },
  registerButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: theme.textSecondary,
  },
  linkText: {
    ...typography.body,
    color: theme.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginVertical: spacing.md,
  },
});

