import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GoogleSignIn } from '@/components/GoogleSignIn';
import { loadAddressBook } from '@/cart/address-book';
import { openPendingProductOr } from '@/nav/open-pending-product';
import { markEnteredShop } from '@/nav/shop-entry';
import { destinationFor } from '@/services/google-auth';
import { getSignedInUser } from '@/services/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const { next: nextParam } = useLocalSearchParams<{ next?: string }>();
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  const requireSignIn =
    next === 'checkout' ||
    next === 'orders' ||
    next === 'buy-again' ||
    next === 'reorder' ||
    next === 'cart' ||
    next === 'sam' ||
    next === 'notifications';
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getSignedInUser().then(async (user) => {
      if (!active) return;
      if (user) {
        await markEnteredShop();
        await loadAddressBook();
        await openPendingProductOr(router, destinationFor(next ?? 'home'));
        return;
      }
      setSignedIn(false);
    });
    return () => {
      active = false;
    };
  }, [next, router]);

  if (signedIn === null) {
    return <View style={{ flex: 1 }} />;
  }

  return <GoogleSignIn allowSkip={!requireSignIn} next={next ?? 'home'} />;
}
