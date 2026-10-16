import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface AvatarProps {
  uri?: string | null;
  /** Name used to derive the initials fallback (and accessibility label). */
  name?: string | null;
  size?: number;
  /** Renders a green presence dot in the bottom-right corner. */
  online?: boolean;
  style?: ViewStyle;
}

/** First letters of the first two words — "Sam Rivera" → "SR". */
function initials(name?: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

/**
 * Circle avatar shared by the feed, chat list, chat bubbles and sheets.
 * Shows a photo when available, otherwise a tinted initials tile.
 */
export function Avatar({ uri, name, size = 40, online, style }: AvatarProps) {
  const theme = useTheme();
  const dot = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          { backgroundColor: theme.backgroundElement, width: size, height: size, borderRadius: size },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <ThemedText
            themeColor="textSecondary"
            style={{ fontSize: size * 0.36, fontWeight: '700' }}
          >
            {initials(name)}
          </ThemedText>
        )}
      </View>

      {online ? (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: theme.tertiary,
              borderColor: theme.background,
              width: dot,
              height: dot,
              borderRadius: dot,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
