import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassButton } from '@/components/premium/glass';
import { Reveal } from '@/components/premium/motion';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  /** Optional bulleted list rendered after the paragraphs. */
  bullets?: string[];
}

/**
 * A premium, scrollable legal document (privacy policy, terms). Renders a
 * tinted hero with a floating glass back button, then each section fades/rises
 * in. Content is passed in as data so every legal screen shares one layout.
 */
export function LegalDocument({
  title,
  eyebrow,
  updated,
  sections,
  accent,
}: {
  title: string;
  eyebrow: string;
  /** Human-readable "last updated" line. */
  updated: string;
  sections: LegalSection[];
  /** Accent tint for the hero (defaults to the brand primary). */
  accent?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const tint = accent ?? theme.primary;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: tint }]}>
            <View style={styles.heroControls}>
              <GlassButton onPress={() => router.back()} accessibilityLabel="Go back">
                <Ionicons
                  name={Platform.OS === 'android' ? 'arrow-forward' : 'chevron-back'}
                  size={22}
                  color={theme.text}
                />
              </GlassButton>
            </View>
            <View style={styles.heroBody}>
              <ThemedText type="smallBold" style={styles.eyebrow}>
                {eyebrow.toUpperCase()}
              </ThemedText>
              <ThemedText style={styles.heroTitle}>{title}</ThemedText>
              <View style={styles.updatedRow}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.9)" />
                <ThemedText type="small" style={styles.updatedText}>
                  {updated}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Sections */}
          <View style={styles.sections}>
            {sections.map((section, i) => (
              <Reveal key={section.heading} delay={i * 60}>
                <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }, Shadows.card]}>
                  <View style={styles.cardHeadingRow}>
                    <View style={[styles.indexBadge, { backgroundColor: `${tint}1A` }]}>
                      <ThemedText type="smallBold" style={{ color: tint }}>
                        {String(i + 1).padStart(2, '0')}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={styles.cardHeading}>
                      {section.heading}
                    </ThemedText>
                  </View>
                  {section.paragraphs.map((p, pi) => (
                    <ThemedText key={pi} type="small" themeColor="textSecondary" style={styles.paragraph}>
                      {p}
                    </ThemedText>
                  ))}
                  {section.bullets?.length ? (
                    <View style={styles.bullets}>
                      {section.bullets.map((b, bi) => (
                        <View key={bi} style={styles.bulletRow}>
                          <View style={[styles.bulletDot, { backgroundColor: tint }]} />
                          <ThemedText type="small" themeColor="textSecondary" style={styles.bulletText}>
                            {b}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Reveal>
            ))}

            <View style={styles.footer}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                Travel Board · Questions? Contact support@travelboard.app
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { paddingBottom: Spacing.six },
  hero: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  heroControls: { marginBottom: Spacing.three },
  heroBody: { gap: Spacing.one },
  eyebrow: { color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2, fontSize: 11 },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
  updatedText: { color: 'rgba(255,255,255,0.9)' },
  sections: { padding: Spacing.three, gap: Spacing.three },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  indexBadge: {
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  cardHeading: { fontSize: 15, fontWeight: '800', flex: 1 },
  paragraph: { lineHeight: 20 },
  bullets: { gap: Spacing.one + Spacing.half, marginTop: Spacing.one },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  footerText: { textAlign: 'center' },
});
