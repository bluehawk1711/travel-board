import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
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
import { Reveal } from '@/components/premium/motion';
import { ThemedText } from '@/components/themed-text';
import { Chip, PillButton } from '@/components/ui/pill-button';
import { MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { UI_MESSAGES } from '@travel-board/shared';

/** A titled card that groups related settings rows. */
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }, Shadows.card]}>
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      {children}
    </View>
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
  const [avatarError, setAvatarError] = useState<string | null>(null);

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

  const avatarMutation = useMutation({
    mutationFn: async (asset: { uri: string; name: string; type: string }) => {
      const { url } = await api.uploadImage(asset);
      await api.updateMyProfile({ avatarUrl: url });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => {
      setAvatarError(err instanceof ApiError ? err.message : UI_MESSAGES.SETTINGS.AVATAR_UPLOAD_FAILED);
    },
  });

  const handleAvatarUpload = useCallback(async () => {
    setAvatarError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      avatarMutation.mutate({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
    } catch {
      setAvatarError(UI_MESSAGES.SETTINGS.AVATAR_UPLOAD_FAILED);
    }
  }, [avatarMutation]);

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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Reveal style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>
              Settings
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Manage your profile and preferences
            </ThemedText>
          </Reveal>

          {/* Profile card */}
          <Reveal delay={60}>
            <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }, Shadows.card]}>
              <View style={styles.profileRow}>
                <Pressable onPress={handleAvatarUpload} style={styles.avatarWrap}>
                  <Avatar uri={user?.avatarUrl} name={user?.name} size={72} />
                  <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                    <Ionicons name="camera" size={13} color={theme.onPrimary} />
                  </View>
                </Pressable>
                <View style={styles.profileText}>
                  <ThemedText type="smallBold" style={styles.profileName}>
                    {user?.name ?? '…'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {user?.email ?? ''}
                  </ThemedText>
                  <Pressable onPress={handleAvatarUpload}>
                    <ThemedText type="small" style={{ color: theme.primary, marginTop: 2 }}>
                      Change photo
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
              {avatarError ? (
                <ThemedText type="small" style={{ color: theme.danger }}>{avatarError}</ThemedText>
              ) : null}

              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="textSecondary">NAME</ThemedText>
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
                <ThemedText type="smallBold" themeColor="textSecondary">BIO</ThemedText>
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
                style={[styles.primaryButton, { backgroundColor: theme.primary }, !saving && Shadows.fab, saving && styles.disabled]}
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
          <Reveal delay={120}>
            <Card title="Appearance">
              <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>Theme</ThemedText>
              <View style={styles.chipRow}>
                {(['SYSTEM', 'LIGHT', 'DARK'] as const).map((mode) => (
                  <Chip
                    key={mode}
                    label={mode === 'SYSTEM' ? 'System' : mode === 'LIGHT' ? 'Light' : 'Dark'}
                    active={(settings?.themeMode ?? 'SYSTEM') === mode}
                    disabled={settingsSaving}
                    onPress={() => void saveSettings({ themeMode: mode })}
                  />
                ))}
              </View>
              <View style={[styles.hr, { backgroundColor: theme.borderSubtle }]} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>Currency</ThemedText>
              <View style={styles.chipRow}>
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
            </Card>
          </Reveal>

          {/* Notifications */}
          <Reveal delay={180}>
            <Card title="Notifications">
              {([
                { key: 'notificationsEnabled' as const, label: 'Push notifications', icon: 'notifications-outline' as const },
                { key: 'emailUpdates' as const, label: 'Email updates', icon: 'mail-outline' as const },
              ]).map(({ key, label, icon }, i) => (
                <View key={key}>
                  {i > 0 ? <View style={[styles.hr, { backgroundColor: theme.borderSubtle }]} /> : null}
                  <Pressable
                    onPress={() => settings && void saveSettings({ [key]: !settings[key] })}
                    disabled={settingsSaving || !settings}
                    style={styles.toggleRow}
                  >
                    <View style={styles.toggleLabel}>
                      <Ionicons name={icon} size={17} color={theme.textSecondary} />
                      <ThemedText type="small">{label}</ThemedText>
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
              {settingsSaved ? (
                <View style={styles.savedRow}>
                  <Ionicons name="checkmark-circle" size={15} color={theme.tertiary} />
                  <ThemedText type="small" style={{ color: theme.tertiary }}>Preferences saved</ThemedText>
                </View>
              ) : null}
            </Card>
          </Reveal>

          {/* Legal */}
          <Reveal delay={240}>
            <Card title="About">
              {[
                { label: 'Privacy Policy', icon: 'lock-closed-outline' as const, href: '/legal/privacy' as const },
                { label: 'Terms & Conditions', icon: 'document-text-outline' as const, href: '/legal/terms' as const },
              ].map((row, i) => (
                <View key={row.label}>
                  {i > 0 ? <View style={[styles.hr, { backgroundColor: theme.borderSubtle }]} /> : null}
                  <Pressable onPress={() => router.push(row.href)} style={styles.linkRow}>
                    <View style={styles.toggleLabel}>
                      <Ionicons name={row.icon} size={17} color={theme.textSecondary} />
                      <ThemedText type="small">{row.label}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </Reveal>

          {/* Sign out */}
          <Reveal delay={300}>
            <PillButton label="Sign out" variant="ghost" onPress={handleSignOut} style={styles.signOut} />
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
  header: { gap: 2, marginTop: Spacing.two },
  headerTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  cardTitle: { letterSpacing: 0.6, fontSize: 11 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatarWrap: { width: 72, height: 72 },
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
  profileName: { fontSize: 18, fontWeight: '800' },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
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
  rowLabel: { marginBottom: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  hr: { height: StyleSheet.hairlineWidth },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.one },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.one },
  toggle: { width: 46, height: 28, borderRadius: 999, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  toggleKnobOn: { alignSelf: 'flex-end' },
  signOut: { marginTop: Spacing.one },
  version: { textAlign: 'center', marginTop: Spacing.two },
});
