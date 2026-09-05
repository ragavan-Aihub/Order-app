import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { WelcomeSignup } from '@/components/WelcomeSignup';
import { getSignedInUser } from '@/services/supabase';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    getSignedInUser().then((user) => {
      if (user) {
        router.replace('/products');
      }
    });
  }, [router]);

  return <WelcomeSignup allowSkip next="products" />;
}
