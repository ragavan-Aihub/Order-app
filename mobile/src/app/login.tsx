import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { WelcomeSignup } from '@/components/WelcomeSignup';

export default function LoginScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string }>();
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  const [initialMobile, setInitialMobile] = useState('');
  const requireSignIn = next === 'checkout' || next === 'orders';

  useEffect(() => {
    loadDeliveryDraft().then((draft) => {
      if (draft?.mobile) {
        setInitialMobile(draft.mobile);
      }
    });
  }, []);

  return (
    <WelcomeSignup
      allowSkip={!requireSignIn}
      next={next ?? 'products'}
      initialMobile={initialMobile}
    />
  );
}
