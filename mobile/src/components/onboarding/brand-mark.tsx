import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APP } from '@travel-board/shared';

export interface BrandMarkProps {
  /** Solid terracotta tile (intro slides) vs tinted container (final slide). */
  tone?: 'solid' | 'soft';
  /** Edge length of the rounded icon tile in dp. */
  size?: number;
}

/** App wordmark: compass tile + `APP.name` (never a hardcoded brand string). */
export function BrandMark({ tone = 'solid', size = 34 }: BrandMarkProps) {
  const theme = useTheme();
  const background = tone === 'solid' ? theme.primary : theme.primaryContainer;
  const foreground = tone === 'solid' ? theme.onPrimary : theme.primaryDark;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.tile,
          { backgroundColor: background, width: size, height: size },
        ]}
      >
        <MaterialIcons name="explore" size={Math.round(size * 0.62)} color={foreground} />
      </View>
      <ThemedText style={styles.name}>{APP.name}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tile: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});
