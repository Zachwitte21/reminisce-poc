import { Stack } from 'expo-router';

export default function CaregiverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="schedule"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
