import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { FadeInScale } from '@/components/premium/motion';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { BoardItem, BoardItemType } from '@/lib/board-types';
import type { PlaceResult } from '@/lib/types';
import { UI_MESSAGES } from '@travel-board/shared';

/** Types that map to a Google Places result (show the search field). */
const PLACE_TYPES: BoardItemType[] = [
  'PLACE',
  'RESTAURANT',
  'HOTEL',
  'ACTIVITY',
];

const TYPE_LABELS: Record<BoardItemType, string> = {
  PLACE: 'Place',
  IMAGE: 'Image',
  NOTE: 'Note',
  LINK: 'Link',
  RESTAURANT: 'Food',
  HOTEL: 'Stay',
  ACTIVITY: 'Activity',
};

export interface ItemFormPayload {
  type: BoardItemType;
  title: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  date?: string;
}

/**
 * Create/edit an item — one modal for both modes (pass `item` to edit), so the
 * type picker, Places search and image upload exist in exactly one place
 * (AGENTS.md §4).
 */
export function ItemFormModal({
  visible,
  onClose,
  onSaved,
  boardId,
  sectionId,
  item,
  showDate = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  boardId: string;
  sectionId: string;
  /** Present → edit mode. */
  item?: BoardItem | null;
  /** Show the per-item date field (ITINERARY boards only). */
  showDate?: boolean;
}) {
  const theme = useTheme();
  const isEdit = !!item;

  const [type, setType] = useState<BoardItemType>('PLACE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [submittedPlaceQuery, setSubmittedPlaceQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Places search goes through React Query: identical searches are deduped and
  // reused for a day (Places calls are billed — AGENTS.md §6).
  const placesQuery = useQuery({
    queryKey: ['places', 'search', submittedPlaceQuery],
    queryFn: () => api.searchPlaces(submittedPlaceQuery),
    enabled: submittedPlaceQuery.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const results = placesQuery.data ?? [];
  const searching = placesQuery.isFetching;
  const placesMessage =
    !searching && submittedPlaceQuery.length > 0 && results.length === 0
      ? 'No places matched that search'
      : null;

  // Writes run through React Query mutations.
  const saveMutation = useMutation({
    mutationFn: (args: {
      itemId: string | null;
      body: Parameters<typeof api.createItem>[2];
    }) =>
      args.itemId
        ? api.updateItem(boardId, sectionId, args.itemId, args.body)
        : api.createItem(boardId, sectionId, args.body),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError ? err.message : UI_MESSAGES.BOARDS.SAVE_ITEM_FAILED,
      );
    },
  });
  const saving = saveMutation.isPending;

  const uploadMutation = useMutation({
    mutationFn: (asset: { uri: string; name: string; type: string }) =>
      api.uploadImage(asset),
    onSuccess: ({ url }) => {
      setImageUrl(url);
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError
          ? err.message
          : UI_MESSAGES.BOARDS.IMAGE_UPLOAD_FAILED,
      );
    },
  });

  // Reset/populate the fields each time the modal opens. Adjusting state
  // during render (instead of a synchronous setState effect) avoids the
  // cascading-render warning while keeping the reset atomic per open.
  const openKey = visible ? (item?.id ?? 'new') : null;
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (visible) {
      setError(null);
      setQuery('');
      setSubmittedPlaceQuery('');
      if (item) {
        setType(item.type);
        setTitle(item.title);
        setDescription(item.description ?? '');
        setUrl(item.url ?? '');
        setDate(item.date ? item.date.slice(0, 10) : '');
        setImageUrl(item.imageUrl);
        setPlaceId(item.placeId);
        setCoords(
          item.lat != null && item.lng != null
            ? { lat: item.lat, lng: item.lng }
            : null,
        );
      } else {
        setType('PLACE');
        setTitle('');
        setDescription('');
        setUrl('');
        setDate('');
        setImageUrl(null);
        setPlaceId(null);
        setCoords(null);
      }
    }
  }

  const searchPlaces = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setSubmittedPlaceQuery(q);
  }, [query]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      uploadMutation.mutate({
        uri: asset.uri,
        name: asset.fileName ?? 'item.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
    } catch {
      setError(UI_MESSAGES.BOARDS.IMAGE_UPLOAD_FAILED);
    }
  }, [uploadMutation]);

  const applyPlace = useCallback((place: PlaceResult) => {
    setTitle(place.name);
    setPlaceId(place.placeId);
    setCoords(place.location ?? null);
    if (place.formattedAddress) {
      setDescription(place.formattedAddress);
    }
    setSubmittedPlaceQuery('');
  }, []);
  const save = useCallback(() => {
    if (!title.trim()) {
      setError(UI_MESSAGES.BOARDS.ITEM_TITLE_REQUIRED);
      return;
    }
    setError(null);
    saveMutation.mutate({
      itemId: item?.id ?? null,
      body: {
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        imageUrl: imageUrl ?? undefined,
        placeId: placeId ?? undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        date: date.trim() || undefined,
      },
    });
  }, [
    title,
    description,
    url,
    imageUrl,
    placeId,
    coords,
    date,
    type,
    item,
    saveMutation,
  ]);

  const showPlaceSearch = PLACE_TYPES.includes(type);

  const inputStyle = {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.backgroundSelected,
    color: theme.text,
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <FadeInScale>
        <Pressable
          style={[styles.card, { backgroundColor: theme.background }, Shadows.nav]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" style={styles.title}>
              {isEdit ? 'Edit item' : 'New item'}
            </ThemedText>

            <View style={styles.typeRow}>
              {PLACE_TYPES.concat(['IMAGE', 'NOTE', 'LINK']).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setType(t);
                    setSubmittedPlaceQuery('');
                    setQuery('');
                  }}
                  disabled={isEdit}
                  style={[
                    styles.typePill,
                    {
                      backgroundColor:
                        type === t ? theme.text : theme.backgroundElement,
                      opacity: isEdit && type !== t ? 0.5 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: type === t ? theme.background : theme.text,
                    }}
                  >
                    {TYPE_LABELS[t]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {showPlaceSearch ? (
              <View style={styles.searchBlock}>
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, styles.searchInput, inputStyle]}
                    placeholder="Search Google Places…"
                    placeholderTextColor={theme.textSecondary}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => void searchPlaces()}
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => void searchPlaces()}
                    disabled={searching}
                    style={[styles.searchBtn, { backgroundColor: theme.text }]}
                  >
                    {searching ? (
                      <ActivityIndicator color={theme.background} size="small" />
                    ) : (
                      <ThemedText
                        type="small"
                        style={{ color: theme.background }}
                      >
                        Find
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
                {coords ? (
                  <ThemedText type="small" themeColor="textSecondary">
                     {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </ThemedText>
                ) : null}
                {results.map((place) => (
                  <Pressable
                    key={place.placeId}
                    onPress={() => applyPlace(place)}
                    style={[
                      styles.resultRow,
                      { borderColor: theme.backgroundSelected },
                    ]}
                  >
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {place.name}
                    </ThemedText>
                    {place.formattedAddress ? (
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        numberOfLines={1}
                      >
                        {place.formattedAddress}
                      </ThemedText>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              style={[styles.input, inputStyle]}
              placeholder="Item title *"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.textArea, inputStyle]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={2}
              value={description}
              onChangeText={setDescription}
            />
            {type === 'LINK' || url ? (
              <TextInput
                style={[styles.input, inputStyle]}
                placeholder="URL (https://…)"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                value={url}
                onChangeText={setUrl}
              />
            ) : null}
            {showDate ? (
              <TextInput
                style={[styles.input, inputStyle]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                value={date}
                onChangeText={setDate}
              />
            ) : null}

            <Pressable onPress={() => void pickImage()} style={styles.imageRow}>
              <View
                style={[styles.imageBtn, { borderColor: theme.backgroundSelected }]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  {imageUrl ? 'Image ✓' : 'Add image'}
                </ThemedText>
              </View>
              {imageUrl ? (
                <Pressable onPress={() => setImageUrl(null)}>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    Remove
                  </ThemedText>
                </Pressable>
              ) : null}
            </Pressable>

            {error || placesMessage ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error ?? placesMessage}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void save()}
                disabled={saving}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.primary },
                  !saving && Shadows.fab,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={theme.onPrimary} size="small" />
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.onPrimary }}
                  >
                    {isEdit ? 'Save' : 'Add'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
        </FadeInScale>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: { marginBottom: Spacing.one },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  typePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
  },
  searchBlock: { gap: Spacing.one },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  searchBtn: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
  },
  resultRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.one + Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  imageBtn: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cancelBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  primaryBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + Spacing.half,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});