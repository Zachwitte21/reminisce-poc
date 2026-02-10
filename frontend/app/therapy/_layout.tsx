import { Stack } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';

export default function TherapyLayout() {
    const theme = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.background },
            }}
        >
            <Stack.Screen
                name="session"
                options={{
                    gestureEnabled: false,
                    animation: 'fade',
                }}
            />
        </Stack>
    );
}
