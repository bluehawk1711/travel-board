import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Sync fields once loaded — via useEffect to avoid extra render cycle.
  useEffect(() => {
    if (user) {
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

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateMyProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
      });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong',
      );
    } finally {
      setSaving(false);
    }
  }, [name, bio, queryClient]);

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
      const { url } = await api.uploadImage({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      await api.updateMyProfile({ avatarUrl: url });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : 'Avatar upload failed',
      );
    }
  }, [queryClient]);

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
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const saveSettings = useCallback(
    async (patch: Parameters<typeof api.updateSettings>[0]) => {
      setSettingsSaving(true);
      try {
        const updated = await api.updateSettings(patch);
        queryClient.setQueryData(['me', 'settings'], updated);
        setSettingsSaved(true);
        savedTimerRef.current = setTimeout(() => setSettingsSaved(false), 2000);
      } catch {
        // Keep silent — surfaced on next fetch; settings are non-critical.
      } finally {
        setSettingsSaving(false);
      }
    },
    [queryClient],
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
          <Pressable onPress={handleAvatarUpload} style={styles.avatarBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              Change avatar
            </ThemedText>
          </Pressable>
          {avatarError ? (
            <ThemedText type="small" style={{ color: '#dc2626' }}>
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
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {error}
            </ThemedText>
          ) : null}
          {saved ? (
            <ThemedText type="small" style={{ color: '#10b981' }}>
              Saved!
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

          <View style={styles.divider} />

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

          <View style={styles.divider} />

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
    borderColor: '#60646C',
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
    backgroundColor: '#60646C',
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
