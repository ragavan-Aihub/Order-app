import { useLocalSearchParams } from 'expo-router';

import { WelcomeSignup } from '@/components/WelcomeSignup';

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function LinkPhoneScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string }>();
  return <WelcomeSignup allowSkip={false} next={first(nextParam) ?? 'home'} />;
}
