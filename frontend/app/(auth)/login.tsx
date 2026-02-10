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

const MAX_WIDTH = 480; // Login/Auth screens usually look better even narrower

export default function LoginScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { login, isLoading } = useAuthStore();

  const isLargeScreen = windowWidth > MAX_WIDTH;
  const contentPadding = isLargeScreen ? spacing.xxl : spacing.lg;

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      await login({ email, password });
      router.replace('/');
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Invalid credentials');
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue to Reminisce</Text>
            </View>

            <Card style={styles.card}>
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
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                error={errors.password}
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                style={styles.loginButton}
              />
            </Card>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.linkText}>Sign Up</Text>
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
  loginButton: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
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
});

