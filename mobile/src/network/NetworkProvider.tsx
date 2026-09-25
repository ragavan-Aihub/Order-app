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

export function NetworkProvider({ children }: { children: ReactNode }) {
  const state = Network.useNetworkState();
  const offline = isDefinitelyOffline(state);
  const [blocking, setBlocking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    hasCatalogCache()
      .then((cached) => {
        setCacheReady(cached);
        if (!cached) {
          getIsOffline().then((down) => {
            if (down) {
              setBlocking(true);
            }
          });
        }
      })
      .catch(() => undefined);
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
});
