import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Dissolve, Reveal } from '@/components/premium/motion';
import { ScreenHeader } from '@/components/premium/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/pill-button';
import { MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAvatarUpload } from '@/hooks/use-avatar-upload';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { UI_MESSAGES } from '@travel-board/shared';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Rounded tinted tile that gives every row a premium icon anchor. */
function IconTile({ name, tint, bg }: { name: IoniconName; tint: string; bg: string }) {
  return (
    <View style={[styles.iconTile, { backgroundColor: bg }]}>
      <Ionicons name={name} size={16} color={tint} />
    </View>
  );
}

/** Section card: uppercase title with icon, grouped rows inside. */
function SectionCard({
  icon,
  title,
  delay = 0,
  children,
}: {
  icon: IoniconName;
  title: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Reveal delay={delay}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
          Shadows.card,
        ]}
      >
        <View style={styles.sectionHead}>
          <IconTile name={icon} tint={theme.primary} bg={theme.backgroundElement} />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
            {title.toUpperCase()}
          </ThemedText>
        </View>
        {children}
      </View>
    </Reveal>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: api.me });
  const user = meQuery.data?.user;

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pickAvatar, error: avatarError } = useAvatarUpload();

  const seededRef = useRef(false);
  useEffect(() => {
    if (user && !seededRef.current) {
      seededRef.current = true;
      setName(user.name);
      setBio(user.bio ?? '');
    }
  }, [user]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const profileMutation = useMutation({
    mutationFn: (patch: { name: string; bio?: string }) => api.updateMyProfile(patch),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: Error) => {
      setError(err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR);
    },
  });
  const saving = profileMutation.isPending;

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError(UI_MESSAGES.SETTINGS.NAME_REQUIRED);
      return;
    }
    setError(null);
    profileMutation.mutate({ name: name.trim(), bio: bio.trim() });
  }, [name, bio, profileMutation]);

  const handleAvatarUpload = pickAvatar;

  const handleSignOut = useCallback(async () => {
    await signOut();
    queryClient.clear();
    router.replace('/(auth)/sign-in');
  }, [queryClient, router, signOut]);

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle, color: theme.text },
  ];

  const settingsQuery = useQuery({ queryKey: ['me', 'settings'], queryFn: api.getSettings });
  const settings = settingsQuery.data;
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Appearance: apply the mode locally first (instant, survives restarts via
  // AsyncStorage), then mirror it to the server-side settings row.
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const themeAdoptedRef = useRef(false);

  useEffect(() => {
    // Adopt the saved server value once per load so logging in elsewhere
    // keeps the same appearance; chip presses already keep store + cache in
    // sync themselves (the guard stops the old server value from reverting
    // a press made before this query resolved).
    const serverMode = settings?.themeMode;
    if (serverMode && !themeAdoptedRef.current) {
      themeAdoptedRef.current = true;
      if (serverMode !== themeMode) void setThemeMode(serverMode);
    }
  }, [settings?.themeMode, themeMode, setThemeMode]);

  const settingsMutation = useMutation({
    mutationFn: (patch: NonNullable<Parameters<typeof api.updateSettings>[0]>) => api.updateSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me', 'settings'], updated);
      setSettingsSaved(true);
      savedTimerRef.current = setTimeout(() => setSettingsSaved(false), 2000);
    },
    onError: () => {},
  });
  const settingsSaving = settingsMutation.isPending;

  const saveSettings = useCallback(
    (patch: Parameters<typeof api.updateSettings>[0]) => settingsMutation.mutate(patch),
    [settingsMutation],
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Sticky premium top bar */}
        <ScreenHeader title="Settings" divider />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile hero */}
          <Reveal>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
                Shadows.card,
              ]}
            >
              <Dissolve style={styles.heroBand} color={theme.primary} speed={0.35} intensity={0.8}>
                <View style={{ flex: 1 }} />
              </Dissolve>

              <View style={styles.profileRow}>
                <Pressable onPress={handleAvatarUpload} style={styles.avatarWrap}>
                  <View style={[styles.avatarRing, { borderColor: theme.primary, backgroundColor: theme.surfaceCard }]}>
                    <Avatar uri={user?.avatarUrl} name={user?.name} size={64} />
                  </View>
                  <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.surfaceCard }]}>
                    <Ionicons name="camera" size={13} color={theme.onPrimary} />
                  </View>
                </Pressable>
                <View style={styles.profileText}>
                  <ThemedText type="subtitle" style={styles.profileName} numberOfLines={1}>
                    {user?.name ?? '…'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {user?.email ?? ''}
                  </ThemedText>
                  <Pressable onPress={handleAvatarUpload} hitSlop={6}>
                    <ThemedText type="smallBold" style={{ color: theme.primary, marginTop: 2 }}>
                      Change photo
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
              {avatarError ? (
                <ThemedText type="small" style={{ color: theme.danger }}>{avatarError}</ThemedText>
              ) : null}

              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.fieldLabel}>
                  NAME
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  placeholder="Name"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.fieldLabel}>
                  BIO
                </ThemedText>
                <TextInput
                  style={[inputStyle, styles.textArea]}
                  placeholder="Tell travelers about yourself (optional)"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={bio}
                  onChangeText={setBio}
                />
              </View>

              {error ? <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText> : null}
              {saved ? (
                <View style={styles.savedRow}>
                  <Ionicons name="checkmark-circle" size={15} color={theme.tertiary} />
                  <ThemedText type="small" style={{ color: theme.tertiary }}>{UI_MESSAGES.SETTINGS.SAVED}</ThemedText>
                </View>
              ) : null}

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  !saving && Shadows.fab,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Save changes</ThemedText>
                )}
              </Pressable>
            </View>
          </Reveal>

          {/* Appearance */}
          <SectionCard icon="color-palette-outline" title="Appearance" delay={60}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
              Theme
            </ThemedText>
            <View style={[styles.chipRow, { backgroundColor: theme.backgroundElement }]}>
              {(['SYSTEM', 'LIGHT', 'DARK'] as const).map((mode) => (
                <Chip
                  key={mode}
                  label={mode === 'SYSTEM' ? 'System' : mode === 'LIGHT' ? 'Light' : 'Dark'}
                  active={themeMode === mode}
                  disabled={settingsSaving}
                  onPress={() => {
                    void setThemeMode(mode);
                    void saveSettings({ themeMode: mode });
                  }}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
              Currency
            </ThemedText>
            <View style={[styles.chipRow, { backgroundColor: theme.backgroundElement }]}>
              {['USD', 'EUR', 'GBP', 'JPY', 'INR'].map((code) => (
                <Chip
                  key={code}
                  label={code}
                  active={(settings?.currency ?? 'USD') === code}
                  disabled={settingsSaving}
                  onPress={() => void saveSettings({ currency: code })}
                />
              ))}
            </View>
            {settingsSaved ? (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={15} color={theme.tertiary} />
                <ThemedText type="small" style={{ color: theme.tertiary }}>Preferences saved</ThemedText>
              </View>
            ) : null}
          </SectionCard>

          {/* Notifications */}
          <SectionCard icon="notifications-outline" title="Notifications" delay={120}>
            {([
              { key: 'notificationsEnabled' as const, label: 'Push notifications', hint: 'Trip updates and mentions', icon: 'notifications-outline' as const },
              { key: 'emailUpdates' as const, label: 'Email updates', hint: 'Weekly discovery digest', icon: 'mail-outline' as const },
            ]).map(({ key, label, hint, icon }, i) => (
              <View key={key}>
                {i > 0 ? <View style={[styles.hr, { backgroundColor: theme.borderSubtle }]} /> : null}
                <Pressable
                  onPress={() => settings && void saveSettings({ [key]: !settings[key] })}
                  disabled={settingsSaving || !settings}
                  style={styles.toggleRow}
                >
                  <View style={styles.toggleLabel}>
                    <IconTile name={icon} tint={theme.textSecondary} bg={theme.backgroundElement} />
                    <View>
                      <ThemedText type="smallBold">{label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                        {hint}
                      </ThemedText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      { backgroundColor: settings && settings[key] ? theme.primary : theme.backgroundElement },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        settings?.[key] && styles.toggleKnobOn,
                        { backgroundColor: settings && settings[key] ? theme.onPrimary : theme.textSecondary },
                      ]}
                    />
                  </View>
                </Pressable>
              </View>
            ))}
          </SectionCard>

          {/* About */}
          <SectionCard icon="information-circle-outline" title="About" delay={180}>
            {[
              { label: 'Privacy Policy', icon: 'lock-closed-outline' as const, href: '/legal/privacy' as const },
              { label: 'Terms & Conditions', icon: 'document-text-outline' as const, href: '/legal/terms' as const },
            ].map((row, i) => (
              <View key={row.label}>
                {i > 0 ? <View style={[styles.hr, { backgroundColor: theme.borderSubtle }]} /> : null}
                <Pressable
                  onPress={() => router.push(row.href)}
                  style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.toggleLabel}>
                    <IconTile name={row.icon} tint={theme.textSecondary} bg={theme.backgroundElement} />
                    <ThemedText type="smallBold">{row.label}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}
          </SectionCard>

          {/* Sign out */}
          <Reveal delay={240}>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutRow,
                { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconTile name="log-out-outline" tint={theme.danger} bg={theme.backgroundElement} />
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Sign out
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
              Travel Board · v1.0.0
            </ThemedText>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },

  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },

  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { letterSpacing: 0.8, fontSize: 11 },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: Radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroBand: {
    height: 72,
    marginHorizontal: -Spacing.four,
    marginTop: -Spacing.four,
    overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: -34 },
  avatarWrap: { width: 72, height: 72 },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  field: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.6, fontSize: 10 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  primaryButton: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  disabled: { opacity: 0.5 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },

  rowLabel: { marginBottom: -Spacing.one, letterSpacing: 0.3 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    padding: Spacing.one + Spacing.half,
    borderRadius: Radius.full,
  },
  hr: { height: StyleSheet.hairlineWidth },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one + Spacing.half,
    gap: Spacing.two,
  },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one + Spacing.half,
  },
  toggle: { width: 46, height: 28, borderRadius: 999, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  toggleKnobOn: { alignSelf: 'flex-end' },

  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.three + Spacing.half,
  },
  version: { textAlign: 'center', marginTop: Spacing.two },
});
