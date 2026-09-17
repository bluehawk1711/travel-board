import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * To support static rendering, the value needs to be re-calculated on the
 * client side for web: return 'light' during server render, then the real
 * scheme once hydrated. `useSyncExternalStore` handles the client/server
 * snapshot split without an effect.
 */
export function useColorScheme() {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );

  const colorScheme = useRNColorScheme();

  if (isHydrated) {
    return colorScheme;
  }

  return 'light';
}