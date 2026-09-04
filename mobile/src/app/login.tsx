import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { WelcomeSignup } from '@/components/WelcomeSignup';

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [initialMobile, setInitialMobile] = useState('');
  const fromCheckout = next === 'checkout';

  useEffect(() => {
    loadDeliveryDraft().then((draft) => {
      if (draft?.mobile) {
        setInitialMobile(draft.mobile);
      }
    });
  }, []);

  return (
    <WelcomeSignup
      allowSkip={!fromCheckout}
      next={next ?? 'checkout'}
      initialMobile={initialMobile}
    />
  );
}
