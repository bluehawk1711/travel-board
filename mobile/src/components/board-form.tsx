import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Dissolve } from '@/components/premium/motion';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { UI_MESSAGES } from '@travel-board/shared';

export type BoardVisibility = 'PUBLIC' | 'PRIVATE';
export type BoardType = 'ITINERARY' | 'FREEFORM';

export interface BoardFormValues {
  title: string;
  destination?: string;
  description?: string;
  visibility: BoardVisibility;
  boardType: BoardType;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
}

/** Uppercase field label used across the form. */
function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

/** One option of a segmented control (type / visibility pickers). */
function SegOption({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segOption,
        active && { backgroundColor: theme.surfaceCard, ...Shadows.card },
      ]}
    >
      <Ionicons name={icon} size={14} color={active ? theme.primary : theme.textSecondary} />
      <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Shared create/edit board form. `create.tsx` and `edit.tsx` differ only in the
 * initial values and submit handler, so the whole form lives here — one place
 * to change a field (AGENTS.md §4: reuse components, never copy them).
 */
export function BoardForm({
  initialValues,
  submitLabel,
  onSubmit,
  saving = false,
  error,
}: {
  initialValues?: Partial<BoardFormValues>;
  submitLabel: string;
  onSubmit: (values: BoardFormValues) => void | Promise<void>;
  saving?: boolean;
  error?: string | null;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [destination, setDestination] = useState(
    initialValues?.destination ?? '',
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? '');
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? '');
  const [visibility, setVisibility] = useState<BoardVisibility>(
    initialValues?.visibility ?? 'PUBLIC',
  );
  const [boardType, setBoardType] = useState<BoardType>(
    initialValues?.boardType ?? 'FREEFORM',
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialValues?.coverImageUrl ?? null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Cover upload runs through a React Query mutation.
  const coverMutation = useMutation({
    mutationFn: (asset: { uri: string; name: string; type: string }) =>
      api.uploadImage(asset),
    onSuccess: ({ url }) => {
      setCoverImageUrl(url);
    },
    onError: (err: Error) => {
      setLocalError(
        err instanceof ApiError
          ? err.message
          : UI_MESSAGES.BOARDS.COVER_UPLOAD_FAILED,
      );
    },
  });
  const uploadingCover = coverMutation.isPending;

  const pickCover = useCallback(async () => {
    setLocalError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      coverMutation.mutate({
        uri: asset.uri,
        name: asset.fileName ?? 'cover.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
    } catch {
      setLocalError(UI_MESSAGES.BOARDS.COVER_UPLOAD_FAILED);
    }
  }, [coverMutation]);

  const submit = useCallback(() => {
    if (!title.trim()) {
      setLocalError(UI_MESSAGES.BOARDS.TITLE_REQUIRED);
      return;
    }
    setLocalError(null);
    void onSubmit({
      title: title.trim(),
      destination: destination.trim() || undefined,
      description: description.trim() || undefined,
      visibility,
      boardType,
      startDate: startDate.trim() || undefined,
      endDate: endDate.trim() || undefined,
      coverImageUrl: coverImageUrl ?? undefined,
    });
  }, [
    title,
    destination,
    description,
    visibility,
    boardType,
    startDate,
    endDate,
    coverImageUrl,
    onSubmit,
  ]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.borderSubtle,
      color: theme.text,
    },
  ];
  const shownError = error ?? localError;

  return (
    <View style={styles.form}>
      {/* Cover hero picker */}
      <Pressable
        onPress={() => void pickCover()}
        style={({ pressed }) => [
          styles.cover,
          { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle },
          pressed && styles.pressed,
        ]}
      >
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Dissolve style={StyleSheet.absoluteFill} color={theme.primary} speed={0.4} />
        )}
        <View style={[styles.coverScrim, { backgroundColor: theme.overlay }]} />
        <View style={styles.coverCenter}>
          <View style={[styles.coverIcon, { backgroundColor: theme.overlay }]}>
            {uploadingCover ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons
                name={coverImageUrl ? 'image-outline' : 'camera-outline'}
                size={20}
                color="#fff"
              />
            )}
          </View>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {uploadingCover
              ? 'Uploading…'
              : coverImageUrl
                ? 'Change cover image'
                : 'Add cover image'}
          </ThemedText>
        </View>
      </Pressable>

      {/* Title */}
      <View style={styles.field}>
        <FieldLabel>TITLE *</FieldLabel>
        <TextInput
          style={[...inputStyle, styles.titleInput]}
          placeholder="e.g. Iceland Ring Road — Photo Spots"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Destination */}
      <View style={styles.field}>
        <FieldLabel>DESTINATION</FieldLabel>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle },
          ]}
        >
          <Ionicons name="location-outline" size={17} color={theme.textSecondary} />
          <TextInput
            style={[styles.inputFlex, { color: theme.text }]}
            placeholder="Where to? (optional)"
            placeholderTextColor={theme.textSecondary}
            value={destination}
            onChangeText={setDestination}
          />
        </View>
      </View>

      {/* Description */}
      <View style={styles.field}>
        <FieldLabel>DESCRIPTION</FieldLabel>
        <TextInput
          style={[...inputStyle, styles.textArea]}
          placeholder="What's this trip about? (optional)"
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Board type */}
      <View style={styles.field}>
        <FieldLabel>BOARD TYPE</FieldLabel>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          <SegOption
            active={boardType === 'ITINERARY'}
            icon="map-outline"
            label="Itinerary"
            onPress={() => setBoardType('ITINERARY')}
          />
          <SegOption
            active={boardType === 'FREEFORM'}
            icon="grid-outline"
            label="Freeform"
            onPress={() => setBoardType('FREEFORM')}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {boardType === 'ITINERARY'
            ? 'Day-by-day plan with times and stops.'
            : 'A free-form board for collecting ideas.'}
        </ThemedText>
      </View>

      {/* Dates */}
      <View style={styles.field}>
        <FieldLabel>DATES (OPTIONAL, YYYY-MM-DD)</FieldLabel>
        <View style={styles.dateRow}>
          <View
            style={[
              styles.inputRow,
              styles.dateInput,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle },
            ]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.inputFlex, { color: theme.text }]}
              placeholder="Start"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View
            style={[
              styles.inputRow,
              styles.dateInput,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle },
            ]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.inputFlex, { color: theme.text }]}
              placeholder="End"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>
      </View>

      {/* Visibility */}
      <View style={styles.field}>
        <FieldLabel>VISIBILITY</FieldLabel>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          <SegOption
            active={visibility === 'PUBLIC'}
            icon="globe-outline"
            label="Public"
            onPress={() => setVisibility('PUBLIC')}
          />
          <SegOption
            active={visibility === 'PRIVATE'}
            icon="lock-closed-outline"
            label="Private"
            onPress={() => setVisibility('PRIVATE')}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {visibility === 'PUBLIC'
            ? 'Anyone can discover and save this board.'
            : 'Only you and collaborators can open it.'}
        </ThemedText>
      </View>

      {shownError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {shownError}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={submit}
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
          <>
            <Ionicons name="checkmark-circle-outline" size={17} color={theme.onPrimary} />
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {submitLabel}
            </ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  field: { gap: Spacing.one + Spacing.half },
  fieldLabel: { letterSpacing: 0.6, fontSize: 10 },

  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.35 },
  coverCenter: { alignItems: 'center', gap: Spacing.one + Spacing.half },
  coverIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  input: {
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
  },
  titleInput: { fontSize: 17, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  inputFlex: { flex: 1, fontSize: 15, padding: 0 },
  textArea: { minHeight: 80, textAlignVertical: 'top', fontSize: 15 },

  segment: {
    flexDirection: 'row',
    gap: Spacing.half,
    padding: Spacing.half + 1,
    borderRadius: Radius.full,
  },
  segOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  hint: { fontSize: 11, marginTop: -Spacing.one },

  dateRow: { flexDirection: 'row', gap: Spacing.two },
  dateInput: { flex: 1 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingVertical: Spacing.three + Spacing.half,
    marginTop: Spacing.one,
  },
  disabled: { opacity: 0.5 },
});
