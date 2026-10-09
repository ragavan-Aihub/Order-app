import * as Network from 'expo-network';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineScreen } from '@/components/OfflineScreen';
import { hasCatalogCache } from '@/services/catalog-cache';
import { getIsOffline, isDefinitelyOffline } from '@/services/network';

type NetworkContextValue = {
  offline: boolean;
  blocking: boolean;
  requireConnection: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetworkStatus(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) {
    throw new Error('useNetworkStatus must be used within NetworkProvider');
  }
  return value;
}

const OFFLINE_BANNER_DELAY_MS = 900;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const state = Network.useNetworkState();
  const rawOffline = isDefinitelyOffline(state);
  const [offline, setOffline] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    if (!rawOffline) {
      setOffline(false);
      return;
    }
    const timer = setTimeout(() => setOffline(true), OFFLINE_BANNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rawOffline]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    hasCatalogCache()
      .then((cached) => {
        if (cancelled) {
          return;
        }
        setCacheReady(cached);
        if (!cached) {
          timer = setTimeout(() => {
            getIsOffline().then((down) => {
              if (!cancelled && down) {
                setBlocking(true);
              }
            });
          }, OFFLINE_BANNER_DELAY_MS);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!offline) {
      setBlocking(false);
      return;
    }
    if (!cacheReady) {
      setBlocking(true);
    }
  }, [cacheReady, offline]);

  const refresh = useCallback(async () => {
    setReloading(true);
    const down = await getIsOffline();
    setReloading(false);
    if (!down) {
      setBlocking(false);
      return true;
    }
    setBlocking(true);
    return false;
  }, []);

  const requireConnection = useCallback(async () => {
    const down = await getIsOffline();
    if (down) {
      setBlocking(true);
      return false;
    }
    setBlocking(false);
    return true;
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      offline,
      blocking,
      requireConnection,
      refresh,
    }),
    [blocking, offline, refresh, requireConnection],
  );

  return (
    <NetworkContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {blocking ? (
          <View style={styles.overlay} pointerEvents="auto">
            <OfflineScreen reloading={reloading} onReload={() => { void refresh(); }} />
          </View>
        ) : null}
      </View>
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    elevation: 50,
  },
});
