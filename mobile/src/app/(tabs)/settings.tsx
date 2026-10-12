import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Chip, PillButton } from '@/components/ui/pill-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { UI_MESSAGES } from '@travel-board/shared';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  });

  const user = meQuery.data?.user;

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Seed the fields once when `me` first resolves (the query starts empty on
  // mount); later refetches must not clobber in-progress edits.
  const seededRef = useRef(false);
  useEffect(() => {
    if (user && !seededRef.current) {
      seededRef.current = true;
      setName(user.name);
      setBio(user.bio ?? '');
    }
  }, [user]);

  // Cleanup saved timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Profile saves run through React Query mutations.
  const profileMutation = useMutation({
    mutationFn: (patch: { name: string; bio?: string }) =>
      api.updateMyProfile(patch),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR,
      );
    },
  });
  const saving = profileMutation.isPending;

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError(UI_MESSAGES.SETTINGS.NAME_REQUIRED);
      return;
    }
    setError(null);
    // Always send bio as a string — '' clears it (backend stores NULL).
    profileMutation.mutate({ name: name.trim(), bio: bio.trim() });
  }, [name, bio, profileMutation]);

  const avatarMutation = useMutation({
    mutationFn: async (asset: {
      uri: string;
      name: string;
      type: string;
    }) => {
      const { url } = await api.uploadImage(asset);
      await api.updateMyProfile({ avatarUrl: url });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => {
      setAvatarError(
        err instanceof ApiError
          ? err.message
          : UI_MESSAGES.SETTINGS.AVATAR_UPLOAD_FAILED,
      );
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
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
      color: theme.text,
    },
  ];

  const settingsQuery = useQuery({
    queryKey: ['me', 'settings'],
    queryFn: api.getSettings,
  });
  const settings = settingsQuery.data;
  const [settingsSaved, setSettingsSaved] = useState(false);

  const settingsMutation = useMutation({
    mutationFn: (patch: NonNullable<
      Parameters<typeof api.updateSettings>[0]
    >) => api.updateSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me', 'settings'], updated);
      setSettingsSaved(true);
      savedTimerRef.current = setTimeout(() => setSettingsSaved(false), 2000);
    },
    onError: () => {
      // Silent — settings are non-critical and surfaced on next fetch.
    },
  });
  const settingsSaving = settingsMutation.isPending;

  const saveSettings = useCallback(
    (patch: Parameters<typeof api.updateSettings>[0]) => {
      settingsMutation.mutate(patch);
    },
    [settingsMutation],
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.title}>
            Settings
          </ThemedText>

          {/* Avatar */}
          <Pressable
            onPress={handleAvatarUpload}
            style={[styles.avatarBtn, { borderColor: theme.backgroundSelected }]}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Change avatar
            </ThemedText>
          </Pressable>
          {avatarError ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {avatarError}
            </ThemedText>
          ) : null}

          <TextInput
            style={inputStyle}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder="Bio (optional)"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            value={bio}
            onChangeText={setBio}
          />

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}
          {saved ? (
            <ThemedText type="small" style={{ color: theme.tertiary }}>
              {UI_MESSAGES.SETTINGS.SAVED}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.text },
              saving && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Save changes
              </ThemedText>
            )}
          </Pressable>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.backgroundSelected },
            ]}
          />

          {/* Preferences */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            PREFERENCES
          </ThemedText>

          <View style={styles.prefRow}>
            <ThemedText type="small">Theme</ThemedText>
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
          </View>

          <View style={styles.prefRow}>
            <ThemedText type="small">Currency</ThemedText>
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
          </View>

          {(
            [
              {
                key: 'notificationsEnabled' as const,
                label: 'Notifications',
              },
              {
                key: 'emailUpdates' as const,
                label: 'Email updates',
              },
            ]
          ).map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() =>
                settings && void saveSettings({ [key]: !settings[key] })
              }
              disabled={settingsSaving || !settings}
              style={styles.toggleRow}
            >
              <ThemedText type="small">{label}</ThemedText>
              <View
                style={[
                  styles.toggle,
                  {
                    backgroundColor:
                      settings && settings[key]
                        ? theme.primary
                        : theme.backgroundSelected,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    settings?.[key] && styles.toggleKnobOn,
                    {
                      backgroundColor:
                        settings && settings[key]
                          ? theme.onPrimary
                          : theme.textSecondary,
                    },
                  ]}
                />
              </View>
            </Pressable>
          ))}

          {settingsSaved ? (
            <ThemedText type="small" style={{ color: theme.tertiary }}>
              Preferences saved
            </ThemedText>
          ) : null}

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.backgroundSelected },
            ]}
          />

          <PillButton
            label="Sign out"
            variant="ghost"
            onPress={handleSignOut}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: { gap: Spacing.three },
  title: { marginBottom: Spacing.one },
  avatarBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  disabled: { opacity: 0.5 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  prefRow: { gap: Spacing.two },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
});
