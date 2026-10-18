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
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

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
/** Ignore blocking offline UI while the OS settles network state (launch or return from background). */
const NETWORK_GRACE_MS = 3200;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const state = Network.useNetworkState();
  const rawOffline = isDefinitelyOffline(state);
  const [offline, setOffline] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [networkGrace, setNetworkGrace] = useState(true);

  const beginNetworkGrace = useCallback(() => {
    setNetworkGrace(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getIsOffline().then((down) => {
      if (!cancelled && !down) {
        setOffline(false);
      }
    });
    beginNetworkGrace();
    const graceTimer = setTimeout(() => setNetworkGrace(false), NETWORK_GRACE_MS);
    return () => {
      cancelled = true;
      clearTimeout(graceTimer);
    };
  }, [beginNetworkGrace]);

  useEffect(() => {
    let resumeGraceTimer: ReturnType<typeof setTimeout> | undefined;

    const onAppState = (next: AppStateStatus) => {
      if (next !== 'active') {
        return;
      }
      beginNetworkGrace();
      if (resumeGraceTimer) {
        clearTimeout(resumeGraceTimer);
      }
      resumeGraceTimer = setTimeout(() => setNetworkGrace(false), NETWORK_GRACE_MS);
      void getIsOffline().then((down) => {
        if (!down) {
          setOffline(false);
        }
      });
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      if (resumeGraceTimer) {
        clearTimeout(resumeGraceTimer);
      }
    };
  }, [beginNetworkGrace]);

  useEffect(() => {
    if (!rawOffline) {
      setOffline(false);
      return;
    }
    if (networkGrace) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void getIsOffline().then((down) => {
        if (!cancelled) {
          setOffline(down);
        }
      });
    }, OFFLINE_SCREEN_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawOffline, networkGrace]);

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
