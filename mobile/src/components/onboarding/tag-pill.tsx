import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TagPillProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  /** `primary` for slide badges, `neutral` for feature chips. */
  tone?: 'primary' | 'neutral';
}

/** Icon + label pill used for slide badges ("Inspire & Roam") and perk chips. */
export function TagPill({ icon, label, tone = 'primary' }: TagPillProps) {
  const theme = useTheme();
  const palette =
    tone === 'primary'
      ? { bg: theme.primaryContainer, fg: theme.primaryDark, icon: theme.primaryDark }
      : { bg: theme.backgroundElement, fg: theme.textSecondary, icon: theme.textSecondary };

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <MaterialIcons name={icon} size={13} color={palette.icon} />
      <ThemedText style={[styles.label, { color: palette.fg }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
