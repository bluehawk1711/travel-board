import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { useToastStore, type ToastState, type ToastType } from '@/lib/toast-store';

const colors: Record<ToastType, string> = {
  error: '#dc2626',
  success: '#16a34a',
  info: '#2563eb',
} as const;

export function ToastViewport() {
  const message = useToastStore((state: ToastState) => state.message);
  const type = useToastStore((state: ToastState) => state.type);

  if (!message) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="none">
      <ThemedText
        style={[
          styles.toast,
          {
            backgroundColor: colors[type],
          },
        ]}
        type="smallBold"
      >
        {message}
      </ThemedText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    color: '#ffffff',
    textAlign: 'center',
  },
});
