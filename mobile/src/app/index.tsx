import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { WelcomeSignup } from '@/components/WelcomeSignup';
import { getSupabaseClient } from '@/services/supabase';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/products');
      }
    });
  }, [router]);

  return <WelcomeSignup allowSkip next="products" />;
}
