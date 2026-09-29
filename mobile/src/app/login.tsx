import { useLocalSearchParams } from 'expo-router';

import { WelcomeSignup } from '@/components/WelcomeSignup';

export default function LoginScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string }>();
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  const requireSignIn =
    next === 'checkout' ||
    next === 'orders' ||
    next === 'buy-again' ||
    next === 'reorder' ||
    next === 'cart' ||
    next === 'sam';

  return (
    <WelcomeSignup
      allowSkip={!requireSignIn}
      next={next ?? 'home'}
      initialMobile=""
    />
  );
}
