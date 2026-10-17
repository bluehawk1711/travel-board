import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { PlaceMap, type MapPlace } from '@/components/place-map';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/pill-button';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL, api, ApiError } from '@/lib/api';
import { useToastStore } from '@/lib/toast-store';
import type { MyBoard, PlaceResult } from '@/lib/types';
import { UI_MESSAGES } from '@travel-board/shared';

/** Query text per category chip — the backend proxies Google Text Search. */
const CATEGORY_Q = {
  all: 'tourist attractions',
  food: 'restaurants',
  stays: 'hotels',
} as const;
type Category = keyof typeof CATEGORY_Q;

/** Used until the device fix resolves (or permission is denied). */
const DEFAULT_REGION: Region = {
  latitude: 35.6595,
  longitude: 139.7005,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SEARCH_RADIUS_M = 20_000;

function mapsUrl(lat: number, lng: number): string {
  return Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  }) as string;
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/** Category icon/label derived from the place's Google types. */
function placeKind(p: PlaceResult): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  const t = p.types;
  if (t.some((x) => x.includes('restaurant') || x.includes('cafe') || x.includes('bar'))) {
    return { icon: 'restaurant-outline', label: 'Food & Drink' };
  }
  if (t.some((x) => x.includes('lodging') || x.includes('hotel'))) {
    return { icon: 'bed-outline', label: 'Stay' };
  }
  if (
    t.some((x) => x.includes('museum') || x.includes('park') || x.includes('landmark') || x.includes('attraction'))
  ) {
    return { icon: 'map-outline', label: 'Attraction' };
  }
  return { icon: 'location-outline', label: 'Place' };
}

function placePhotoUrl(photoName: string): string {
  return `${API_URL}/places/photo?name=${encodeURIComponent(photoName)}&w=900`;
}

// ── Save-to-board picker ─────────────────────────────────────────────────────

function AddToBoardModal({
  visible,
  place,
  onClose,
}: {
  visible: boolean;
  place: PlaceResult | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [busyId, setBusyId] = useState<string | null>(null);

  const boardsQuery = useQuery({
    queryKey: ['boards', 'mine'],
    queryFn: api.getMyBoards,
    enabled: visible,
  });

  const addToBoard = async (board: MyBoard) => {
    if (!place || busyId) return;
    setBusyId(board.id);
    try {
      // Boards may not have a section yet — create the first one on demand.
      const detail = await api.getBoard(board.id);
      let sectionId = detail.sections[0]?.id;
      if (!sectionId) {
        const created = await api.createSection(
          board.id,
          board.boardType === 'ITINERARY' ? 'Day 1' : 'Saved',
        );
        sectionId = created.section.id;
      }
      await api.createItem(board.id, sectionId, {
        type: 'PLACE',
        title: place.name,
        description: place.formattedAddress ?? undefined,
        placeId: place.placeId,
        lat: place.location?.lat,
        lng: place.location?.lng,
      });
      await queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      showToast(`Saved to ${board.title}`, 'success');
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR,
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHead}>
            <ThemedText type="subtitle">Save to board</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {boardsQuery.isPending ? (
            <ActivityIndicator color={theme.textSecondary} style={{ paddingVertical: Spacing.four }} />
          ) : (boardsQuery.data ?? []).length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              No boards yet — tap + to create your first one.
            </ThemedText>
          ) : (
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {(boardsQuery.data ?? []).map((board) => (
                <Pressable
                  key={board.id}
                  onPress={() => void addToBoard(board)}
                  disabled={busyId !== null}
                  style={({ pressed }) => [
                    styles.boardRow,
                    {
                      backgroundColor: pressed ? theme.backgroundElement : theme.surfaceCard,
                      borderColor: theme.borderSubtle,
                    },
                  ]}
                >
                  <View style={[styles.boardThumb, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name="grid-outline" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {board.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 11 }}>
                      {board.destination ?? (board.visibility === 'PRIVATE' ? 'Private' : 'Public')} ·{' '}
                      {board.itemCount} items
                    </ThemedText>
                  </View>
                  {busyId === board.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Explore screen ───────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const theme = useTheme();
  const { height: winH } = useWindowDimensions();

  // Search / category
  const [input, setInput] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const q = committedQuery.trim() || CATEGORY_Q[category];

  // Map region — starts null until the first location fix (or default).
  const [region, setRegion] = useState<Region | null>(null);
  const [userRegion, setUserRegion] = useState<Region | null>(null);
  const [locality, setLocality] = useState<string | null>(null);

  // Selection + sheet
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Foreground location → region; falls back to the default region.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos =
            (await Location.getLastKnownPositionAsync({})) ??
            (await Location.getCurrentPositionAsync({}));
          if (cancelled) return;
          const fix: Region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setUserRegion(fix);
          setRegion((r) => r ?? fix);
          return;
        }
      } catch {
        // Permission/position unavailable — fall through to the default.
      }
      if (!cancelled) setRegion((r) => r ?? DEFAULT_REGION);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reverse-geocode the visible region for the map hint pill.
  useEffect(() => {
    if (!region) return;
    let cancelled = false;
    (async () => {
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: region.latitude,
          longitude: region.longitude,
        });
        if (!cancelled) {
          setLocality(place?.city ?? place?.subregion ?? place?.region ?? null);
        }
      } catch {
        // Best effort — the pill just omits the locality.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region]);

  const regionKey = region
    ? `${region.latitude.toFixed(2)},${region.longitude.toFixed(2)}`
    : 'none';

  // Places search — keyed by query + rounded region so map nudges inside the
  // same area reuse the cache (every miss bills Google Places).
  const placesQuery = useQuery({
    queryKey: ['places', q, regionKey],
    queryFn: () => api.searchPlaces(q, region?.latitude, region?.longitude, SEARCH_RADIUS_M),
    enabled: Boolean(region),
    staleTime: 5 * 60_000,
  });

  const results = useMemo(
    () => (placesQuery.data ?? []).filter((p) => p.location != null),
    [placesQuery.data],
  );
  const ranked = useMemo(
    () => [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [results],
  );
  const mapPlaces: MapPlace[] = useMemo(
    () =>
      results.map((p) => ({
        placeId: p.placeId,
        name: p.name,
        lat: p.location!.lat,
        lng: p.location!.lng,
        rating: p.rating,
      })),
    [results],
  );

  // Selection is derived during render: the user's pinned place wins while it
  // is still in the results, otherwise fall back to the top-rated one.
  const selectedId =
    (pinnedId && results.some((p) => p.placeId === pinnedId)
      ? pinnedId
      : ranked[0]?.placeId) ?? null;
  const selected = results.find((p) => p.placeId === selectedId) ?? null;
  const nearby = ranked.filter((p) => p.placeId !== selectedId);

  // ── Sheet: peek/expanded snap heights with drag on the header ──
  const PEEK = Math.max(268, Math.round(winH * 0.36));
  const TALL = Math.max(PEEK + 160, Math.round(winH * 0.74));
  const [expanded, setExpanded] = useState(false);
  // The animated value lives in state (lazy init).
  const [sheetH] = useState(() => new Animated.Value(PEEK));

  // Gesture bookkeeping — refs written only from event handlers and this
  // effect (never read during render, per react-hooks/refs).
  const heightRef = useRef(PEEK);
  const startYRef = useRef(0);
  const dragStartRef = useRef(PEEK);
  const movedRef = useRef(false);
  const snapsRef = useRef({ peek: PEEK, tall: TALL });

  useEffect(() => {
    snapsRef.current = { peek: PEEK, tall: TALL };
    const toValue = expanded ? TALL : PEEK;
    heightRef.current = toValue;
    Animated.spring(sheetH, { toValue, useNativeDriver: false, friction: 10, tension: 90 }).start();
  }, [expanded, PEEK, TALL, sheetH]);

  /** Snap to the nearest edge of the current drag (also used on terminate). */
  const snapSheet = (dy: number) => {
    const { peek, tall } = snapsRef.current;
    const mid = (peek + tall) / 2;
    const target = heightRef.current > mid || (dy < -40 && heightRef.current > peek) ? tall : peek;
    heightRef.current = target;
    setExpanded(target === tall);
    Animated.spring(sheetH, { toValue: target, useNativeDriver: false, friction: 10, tension: 90 }).start();
  };

  const submitSearch = () => {
    Keyboard.dismiss();
    setCommittedQuery(input.trim());
  };

  const clearSearch = () => {
    setInput('');
    setCommittedQuery('');
  };

  const handleLocate = () => {
    if (userRegion) {
      setRegion(userRegion);
    }
  };

  const handleShare = async () => {
    if (!selected) return;
    try {
      await Share.share({
        message: `${selected.name}${selected.formattedAddress ? ` — ${selected.formattedAddress}` : ''} (via Travel Board)`,
      });
    } catch {
      // silent
    }
  };

  const isTopRated = selected != null && ranked[0]?.placeId === selected.placeId;
  const kind = selected ? placeKind(selected) : null;
  const isLoading = !region || (placesQuery.isFetching && results.length === 0);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Full-screen map */}
      <View style={styles.mapWrap}>
        <PlaceMap
          places={mapPlaces}
          selectedId={selectedId}
          region={region}
          onSelect={(id) => setPinnedId(id)}
          onRegionChangeComplete={(next) => setRegion(next)}
        />
      </View>

      {/* Floating search + category chips */}
      <SafeAreaView
        style={styles.topOverlay}
        edges={['top', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: `${theme.background}F2`, borderColor: theme.borderSubtle },
            ]}
          >
            <Ionicons name="search" size={17} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search destinations, hotels, food…"
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {input.length > 0 || committedQuery ? (
              <Pressable onPress={clearSearch} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={handleLocate}
            style={({ pressed }) => [
              styles.locateBtn,
              { backgroundColor: `${theme.background}F2`, borderColor: theme.borderSubtle },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Center on my location"
          >
            <Ionicons name="locate" size={18} color={theme.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {([
            { key: 'all' as const, label: 'All Places' },
            { key: 'food' as const, label: 'Food & Drink' },
            { key: 'stays' as const, label: 'Stays' },
          ]).map((c) => (
            <View
              key={c.key}
              style={[
                styles.chipShell,
                {
                  backgroundColor: `${theme.background}F2`,
                  borderColor: category === c.key && !committedQuery ? theme.primary : theme.borderSubtle,
                },
              ]}
            >
              <Chip
                label={c.label}
                active={category === c.key && !committedQuery}
                onPress={() => {
                  setCommittedQuery('');
                  setInput('');
                  setCategory(c.key);
                }}
              />
            </View>
          ))}
          {placesQuery.isFetching ? (
            <View style={[styles.chipSpinner, { backgroundColor: `${theme.background}F2` }]}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Map hint pill */}
      {results.length > 0 ? (
        <View
          style={[
            styles.hintPill,
            {
              backgroundColor: `${theme.background}F2`,
              borderColor: theme.borderSubtle,
              bottom: PEEK + Spacing.two,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="flame" size={12} color={theme.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 11 }}>
            {locality ? `${locality} · Popular Right Now` : 'Popular Right Now'}
          </ThemedText>
        </View>
      ) : null}

      {/* Place sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetH,
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
            paddingBottom: BottomTabInset + Spacing.two,
          },
        ]}
      >
        {/* Drag handle / header — touch tracked via the responder system so
            the sheet drags with the finger; a tap toggles the snap. */}
        <View
          style={styles.grabArea}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            movedRef.current = false;
            startYRef.current = e.nativeEvent.touches[0]?.pageY ?? 0;
            dragStartRef.current = heightRef.current;
          }}
          onResponderMove={(e) => {
            const y = e.nativeEvent.touches[0]?.pageY;
            if (y == null) return;
            const dy = y - startYRef.current;
            if (Math.abs(dy) > 6) movedRef.current = true;
            const { peek, tall } = snapsRef.current;
            const next = Math.min(tall, Math.max(peek, dragStartRef.current - dy));
            heightRef.current = next;
            sheetH.setValue(next);
          }}
          onResponderRelease={(e) => {
            if (!movedRef.current) {
              // Tap on the header toggles between the two snap points.
              setExpanded((v) => !v);
              return;
            }
            const y = e.nativeEvent.touches[0]?.pageY ?? startYRef.current;
            snapSheet(y - startYRef.current);
          }}
          onResponderTerminate={() => snapSheet(0)}
        >
          <View style={[styles.grabber, { backgroundColor: theme.borderSubtle }]} />
          <View style={styles.sheetHeadRow}>
            {selected ? (
              <View
                style={[
                  styles.topTag,
                  { backgroundColor: isTopRated ? theme.primaryContainer : theme.backgroundElement },
                ]}
              >
                <Ionicons
                  name={isTopRated ? 'flame' : 'star'}
                  size={12}
                  color={isTopRated ? theme.primaryDark : theme.textSecondary}
                />
                <ThemedText
                  type="smallBold"
                  style={{
                    fontSize: 11,
                    color: isTopRated ? theme.primaryDark : theme.textSecondary,
                  }}
                >
                  {isTopRated
                    ? `Top pick${locality ? ` in ${locality}` : ' nearby'}`
                    : 'Recommended'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 11 }}>
                EXPLORE
              </ThemedText>
            )}
            <View style={styles.headActions}>
              {selected ? (
                <Pressable onPress={() => void handleShare()} hitSlop={8} style={styles.headIcon}>
                  <Ionicons name="share-outline" size={17} color={theme.textSecondary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setExpanded((v) => !v)}
                hitSlop={8}
                style={styles.headIcon}
                accessibilityLabel={expanded ? 'Collapse sheet' : 'Expand sheet'}
              >
                <Ionicons
                  name={expanded ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loading / error / empty states */}
          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={theme.primary} />
              <ThemedText type="small" themeColor="textSecondary">
                {region ? 'Finding places near you…' : 'Getting your location…'}
              </ThemedText>
            </View>
          ) : placesQuery.isError && results.length === 0 ? (
            <View style={styles.stateBlock}>
              <Ionicons name="cloud-offline-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Couldn&apos;t load places. Check that the API is running.
              </ThemedText>
              <Pressable
                onPress={() => void placesQuery.refetch()}
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Retry
                </ThemedText>
              </Pressable>
            </View>
          ) : !selected ? (
            <View style={styles.stateBlock}>
              <Ionicons name="map-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {results.length === 0
                  ? `No places match “${q}” here — move the map or try another search.`
                  : 'Tap a pin to see details.'}
              </ThemedText>
            </View>
          ) : (
            <>
              {/* Rating row */}
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={theme.golden} />
                <ThemedText type="smallBold">
                  {selected.rating != null ? selected.rating.toFixed(1) : 'New'}
                </ThemedText>
                {selected.userRatingCount != null ? (
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    ({compact(selected.userRatingCount)} reviews)
                  </ThemedText>
                ) : null}
                {locality ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      ·
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      {locality}
                    </ThemedText>
                  </>
                ) : null}
              </View>

              {/* Title + address */}
              <ThemedText type="title" style={styles.placeTitle} numberOfLines={2}>
                {selected.name}
              </ThemedText>
              <View style={styles.addressRow}>
                {kind ? (
                  <Ionicons name={kind.icon} size={14} color={theme.textSecondary} />
                ) : null}
                <ThemedText type="small" themeColor="textSecondary" style={styles.addressText} numberOfLines={2}>
                  {kind ? `${kind.label} · ` : ''}
                  {selected.formattedAddress ?? 'Address unavailable'}
                </ThemedText>
              </View>

              {/* Photo (expanded only — one Places photo request per view) */}
              {expanded && selected.photoName ? (
                <View style={[styles.photoWrap, { backgroundColor: theme.backgroundElement }]}>
                  <PlacePhoto photoName={selected.photoName} />
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    { backgroundColor: theme.primary },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={17} color={theme.onPrimary} />
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Add to board
                  </ThemedText>
                </Pressable>
                {selected.location ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(mapsUrl(selected.location!.lat, selected.location!.lng))
                    }
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="navigate-outline" size={16} color={theme.text} />
                    <ThemedText type="smallBold">Directions</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {/* Popular nearby */}
              {nearby.length > 0 ? (
                <View style={styles.nearbyBlock}>
                  <View style={styles.nearbyHead}>
                    <View style={[styles.nearbyIcon, { backgroundColor: theme.primaryContainer }]}>
                      <Ionicons name="sparkles-outline" size={12} color={theme.primaryDark} />
                    </View>
                    <ThemedText type="smallBold" style={{ fontSize: 12 }}>
                      Popular nearby
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                      {nearby.length} places
                    </ThemedText>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nearbyRow}
                  >
                    {nearby.map((p) => {
                      const k = placeKind(p);
                      return (
                        <Pressable
                          key={p.placeId}
                          onPress={() => setPinnedId(p.placeId)}
                          style={({ pressed }) => [
                            styles.nearbyCard,
                            {
                              backgroundColor: pressed ? theme.backgroundElement : theme.background,
                              borderColor: theme.borderSubtle,
                            },
                          ]}
                        >
                          <View style={[styles.nearbyThumb, { backgroundColor: theme.backgroundElement }]}>
                            <Ionicons name={k.icon} size={16} color={theme.primary} />
                          </View>
                          <ThemedText type="smallBold" numberOfLines={2} style={{ width: 120 }}>
                            {p.name}
                          </ThemedText>
                          <View style={styles.nearbyMeta}>
                            {p.rating != null ? (
                              <Ionicons name="star" size={11} color={theme.golden} />
                            ) : null}
                            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                              {p.rating != null ? p.rating.toFixed(1) : k.label}
                            </ThemedText>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>

      <AddToBoardModal visible={pickerOpen} place={selected} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

/** Loads the server-streamed Places photo (Google key stays server-side). */
function PlacePhoto({ photoName }: { photoName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri: placePhotoUrl(photoName) }}
      style={styles.photo}
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapWrap: { ...StyleSheet.absoluteFill },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  searchRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  locateBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { gap: Spacing.one, paddingRight: Spacing.four, paddingBottom: Spacing.one },
  chipShell: { borderRadius: Radius.full, borderWidth: 1 },
  chipSpinner: {
    width: 46,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hintPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 14,
  },
  grabArea: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  topTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 1,
    borderRadius: Radius.full,
  },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  retryBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap' },
  placeTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 27 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  addressText: { flex: 1, lineHeight: 17, fontSize: 12 },

  photoWrap: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.one },
  photo: { width: '100%', aspectRatio: 16 / 9 },

  actionRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingVertical: Spacing.three - 2,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three - 2,
  },

  nearbyBlock: { marginTop: Spacing.three, gap: Spacing.two },
  nearbyHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  nearbyIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyRow: { gap: Spacing.two, paddingRight: Spacing.two },
  nearbyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.two,
    gap: Spacing.one,
    alignItems: 'flex-start',
    width: 148,
  },
  nearbyThumb: {
    width: '100%',
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: Spacing.three,
  },
  modalCard: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
    maxHeight: '70%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalList: { gap: Spacing.two },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.two + Spacing.half,
    marginBottom: Spacing.two,
  },
  boardThumb: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
