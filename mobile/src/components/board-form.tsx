import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
      borderColor: theme.backgroundSelected,
      color: theme.text,
    },
  ];
  const shownError = error ?? localError;

  return (
    <View style={styles.card}>
      <TextInput
        style={inputStyle}
        placeholder="Board title *"
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={inputStyle}
        placeholder="Destination (optional)"
        placeholderTextColor={theme.textSecondary}
        value={destination}
        onChangeText={setDestination}
      />
      <TextInput
        style={[inputStyle, styles.textArea]}
        placeholder="Description (optional)"
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />

      <ThemedText type="small" themeColor="textSecondary">
        Board type
      </ThemedText>
      <View style={styles.pillRow}>
        {(['FREEFORM', 'ITINERARY'] as BoardType[]).map((value) => (
          <Pressable
            key={value}
            onPress={() => setBoardType(value)}
            style={[
              styles.pill,
              {
                backgroundColor:
                  boardType === value ? theme.text : theme.backgroundElement,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{
                color: boardType === value ? theme.background : theme.text,
              }}
            >
              {value === 'ITINERARY' ? 'Itinerary' : 'Freeform'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Dates (optional, YYYY-MM-DD)
      </ThemedText>
      <View style={styles.dateRow}>
        <TextInput
          style={[inputStyle, styles.dateInput]}
          placeholder="Start"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={[inputStyle, styles.dateInput]}
          placeholder="End"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          value={endDate}
          onChangeText={setEndDate}
        />
      </View>

      <Pressable onPress={() => void pickCover()} style={styles.coverRow}>
        <View
          style={[styles.coverPreview, { borderColor: theme.backgroundSelected }]}
        >
          {uploadingCover ? (
            <ActivityIndicator color={theme.textSecondary} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {coverImageUrl ? 'Cover ✓' : 'No cover'}
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {coverImageUrl ? 'Change cover image' : 'Add cover image'}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={() =>
          setVisibility(visibility === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE')
        }
        style={styles.toggleRow}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: theme.text,
              backgroundColor:
                visibility === 'PRIVATE' ? theme.text : 'transparent',
            },
          ]}
        >
          {visibility === 'PRIVATE' ? (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              ✓
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="small">Private board</ThemedText>
      </Pressable>

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
          { backgroundColor: theme.text },
          saving && styles.disabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {submitLabel}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: Spacing.two, marginTop: -Spacing.two },
  pill: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  dateRow: { flexDirection: 'row', gap: Spacing.two, marginTop: -Spacing.two },
  dateInput: { flex: 1 },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  coverPreview: {
    width: 64,
    height: 40,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  disabled: { opacity: 0.5 },
});