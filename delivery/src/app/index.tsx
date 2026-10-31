import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { DeliveryBootScreen } from '@/components/DeliveryBootScreen';
import { isSupabaseConfigured } from '@/config/env';

export default function IndexScreen() {
  const { loading, profile } = useAuth();

  if (!isSupabaseConfigured) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return <DeliveryBootScreen />;
  }

  if (profile) {
    return <Redirect href="/(deliver)" />;
  }

  return <Redirect href="/login" />;
}
