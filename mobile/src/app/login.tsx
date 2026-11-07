import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { GoogleSignIn } from '@/components/GoogleSignIn';
import { loadAddressBook } from '@/cart/address-book';
import { markEnteredShop } from '@/nav/shop-entry';
import { destinationFor } from '@/services/google-auth';
import { getSignedInUser } from '@/services/supabase';

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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getSignedInUser().then(async (user) => {
      if (!active) return;
      if (user) {
        await markEnteredShop();
        await loadAddressBook();
      }
      setSignedIn(Boolean(user));
    });
    return () => {
      active = false;
    };
  }, []);

  if (signedIn === null) {
    return null;
  }
  if (signedIn) {
    return <Redirect href={destinationFor(next ?? 'home')} />;
  }

  return <GoogleSignIn allowSkip={!requireSignIn} next={next ?? 'home'} />;
}
