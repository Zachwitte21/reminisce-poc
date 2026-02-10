import { Stack } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="patient-setup" />
      <Stack.Screen name="schedule-setup" />
    </Stack>
  );
}
