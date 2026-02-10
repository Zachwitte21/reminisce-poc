import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function SupporterLayout() {
    const { isAuthenticated, user, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isAuthenticated || !user) {
        return <Redirect href="/(auth)/login" />;
    }

    // Double check role protection, though navigation logic should handle this
    if (user.role !== 'supporter') {
        return <Redirect href="/(caregiver)" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
        </Stack>
    );
}
