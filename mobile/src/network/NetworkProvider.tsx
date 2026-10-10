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
import { getIsOffline, isDefinitelyOffline } from '@/services/network';

type NetworkContextValue = {
  /** True after the device has been offline for a short debounce (same as blocking). */
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

const OFFLINE_SCREEN_DELAY_MS = 1200;
/** Ignore blocking offline UI right after launch while the OS settles network state. */
const STARTUP_GRACE_MS = 2800;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const state = Network.useNetworkState();
  const rawOffline = isDefinitelyOffline(state);
  const [offline, setOffline] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [startupGrace, setStartupGrace] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getIsOffline().then((down) => {
      if (!cancelled && !down) {
        setOffline(false);
      }
    });
    const graceTimer = setTimeout(() => setStartupGrace(false), STARTUP_GRACE_MS);
    return () => {
      cancelled = true;
      clearTimeout(graceTimer);
    };
  }, []);

  useEffect(() => {
    if (!rawOffline) {
      setOffline(false);
      return;
    }
    if (startupGrace) {
      return;
    }
    const timer = setTimeout(() => setOffline(true), OFFLINE_SCREEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rawOffline, startupGrace]);

  const blocking = offline;

  const refresh = useCallback(async () => {
    setReloading(true);
    const down = await getIsOffline();
    setReloading(false);
    if (!down) {
      setOffline(false);
      return true;
    }
    setOffline(true);
    return false;
  }, []);

  const requireConnection = useCallback(async () => {
    const down = await getIsOffline(true);
    if (down) {
      setOffline(true);
      return false;
    }
    setOffline(false);
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
