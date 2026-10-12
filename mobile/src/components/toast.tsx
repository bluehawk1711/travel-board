import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useToastStore, type ToastState, type ToastType } from '@/lib/toast-store';

export function ToastViewport() {
  const theme = useTheme();
  const message = useToastStore((state: ToastState) => state.message);
  const type = useToastStore((state: ToastState) => state.type);

  if (!message) return null;

  const colors: Record<ToastType, string> = {
    error: theme.danger,
    success: theme.tertiary,
    info: theme.info,
  } as const;

  return (
    <SafeAreaView style={styles.container} pointerEvents="none">
      <ThemedText
        style={[
          styles.toast,
          {
            backgroundColor: colors[type],
            color: theme.onPrimary,
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
    textAlign: 'center',
  },
});
