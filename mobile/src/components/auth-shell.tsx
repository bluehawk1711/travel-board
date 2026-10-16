import { useState } from 'react';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APP } from '@travel-board/shared';

/**
 * Shared building blocks for the (auth) screens (sign-in / sign-up).
 *
 * Terra Nova layout: centered brand header on the warm parchment canvas, form
 * fields inside a raised surface card, optional footer row underneath.
 * Screens compose these instead of hand-rolling their own layout (AGENTS §4).
 */

/** Compact form column so fields stay comfortable on tablets. */
const FORM_MAX_WIDTH = 440;

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  /** Fields + actions rendered inside the surface card. */
  children: ReactNode;
  /** Optional row rendered under the card (e.g. "New here? Create account"). */
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const theme = useTheme();

  return (
    <View style={styles.shell}>
      <View style={styles.brand}>
        <View
          style={[
            styles.logoWrap,
            {
              backgroundColor: theme.surfaceCard,
              borderColor: theme.borderSubtle,
            },
            Shadows.card,
          ]}
        >
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`${APP.name} logo`}
          />
        </View>
        <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>
          {APP.namePlural.toUpperCase()}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          },
          Shadows.card,
        ]}
      >
        {children}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export interface AuthFieldProps extends TextInputProps {
  /** Persistent label above the input (placeholders are examples only). */
  label: string;
  /** Trailing slot on the label row (e.g. the "Forgot password?" link). */
  rightSlot?: ReactNode;
}

/** Labeled text input with a terracotta focus ring. */
export function AuthField({
  label,
  rightSlot,
  style,
  onFocus,
  onBlur,
  ...rest
}: AuthFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
        {rightSlot}
      </View>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.primary}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: focused ? theme.primary : theme.borderSubtle,
            color: theme.text,
          },
          style,
        ]}
      />
    </View>
  );
}

/** Inline error banner (tinted surface + danger accent bar). */
export function AuthError({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View
      role="alert"
      style={[
        styles.error,
        {
          backgroundColor: theme.backgroundElement,
          borderLeftColor: theme.danger,
        },
      ]}
    >
      <MaterialIcons
        name="error-outline"
        size={18}
        color={theme.danger}
        style={styles.errorIcon}
      />
      <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
        {message}
      </ThemedText>
    </View>
  );
}

/** "— or —" separator between the form and the Google button. */
export function AuthDivider({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.6,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 20,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    width: '100%',
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
