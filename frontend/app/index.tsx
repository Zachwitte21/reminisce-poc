import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth-store';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    if (user.role === 'supporter') {
      return <Redirect href="/(supporter)" />;
    }
    return <Redirect href="/(caregiver)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
