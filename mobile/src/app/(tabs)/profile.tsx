import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import {
  BoardCard,
  durationLabel,
  type BoardCardModel,
} from '@/components/board-card';
import { Reveal } from '@/components/premium/motion';
import { ScreenHeader } from '@/components/premium/screen-header';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAvatarUpload } from '@/hooks/use-avatar-upload';
import { api } from '@/lib/api';
import type { MyBoard } from '@/lib/types';

/** Vary tile heights to produce the staggered masonry look. */
const TILE_RATIOS = [0.8, 1.0, 0.72, 0.85, 1.0, 0.78];
/** Sentinel grid entry rendered as the "New Board" call-to-action tile. */
const NEW_TILE = '__new_board__';

type Tab = 'boards' | 'saved' | 'trips';

const TABS: { key: Tab; label: string }[] = [
  { key: 'boards', label: 'Boards' },
  { key: 'saved', label: 'Saved' },
  { key: 'trips', label: 'Trips' },
];

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

function toCard(board: MyBoard, index: number): BoardCardModel {
  return {
    id: board.id,
    coverImageUrl: board.coverImageUrl,
    title: board.title,
    destination: board.destination,
    badge:
      board.visibility === 'PRIVATE'
        ? 'Private'
        : board.boardType === 'ITINERARY'
          ? 'Itinerary'
          : null,
    meta: `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'} · ♥ ${board.likeCount}`,
    durationLabel: durationLabel(board),
    aspectRatio: TILE_RATIOS[index % TILE_RATIOS.length],
  };
}

/** Today's board whose date range contains now, with day-of-trip progress. */
function findActiveTrip(boards: MyBoard[]) {
  const dayMs = 86_400_000;
  const now = Date.now();
  const todayStart = Math.floor(now / dayMs) * dayMs;
  for (const board of boards) {
    if (!board.startDate || !board.endDate) continue;
    const start = new Date(board.startDate).getTime();
    const end = new Date(board.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const startDay = Math.floor(start / dayMs) * dayMs;
    const endDay = Math.floor(end / dayMs) * dayMs + dayMs - 1;
    if (todayStart >= startDay && todayStart <= endDay) {
      const day = Math.floor((todayStart - startDay) / dayMs) + 1;
      const total = Math.round((endDay - startDay) / dayMs) + 1;
      return { board, day, total };
    }
  }
  return null;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('boards');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: api.me });
  const user = meQuery.data?.user;

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => api.getProfile(user!.id),
    enabled: Boolean(user),
  });

  const myBoardsQuery = useQuery({
    queryKey: ['boards', 'mine'],
    queryFn: api.getMyBoards,
    enabled: Boolean(user),
  });

  const savedQuery = useQuery({
    queryKey: ['boards', 'saved'],
    queryFn: api.getSavedBoards,
    enabled: Boolean(user),
  });

  const profile = profileQuery.data?.user;
  const myBoards = useMemo(() => myBoardsQuery.data ?? [], [myBoardsQuery.data]);
  const savedBoards = useMemo(() => savedQuery.data ?? [], [savedQuery.data]);
  const trips = useMemo(
    () => myBoards.filter((b) => b.boardType === 'ITINERARY'),
    [myBoards],
  );
  const activeTrip = useMemo(() => findActiveTrip(myBoards), [myBoards]);

  const { pickAvatar, error: avatarError } = useAvatarUpload(async () => {
    if (user) {
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
  });

  const cards = useMemo(() => {
    const source =
      tab === 'saved' ? savedBoards : tab === 'trips' ? trips : myBoards;
    const mapped = source.map((board, index) => toCard(board, index));
    return tab === 'boards'
      ? [...mapped, { id: NEW_TILE } as BoardCardModel]
      : mapped;
  }, [tab, myBoards, savedBoards, trips]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  const handle = user.email.split('@')[0];
  const stats = [
    { label: 'Boards', value: myBoards.length, onPress: () => setTab('boards') },
    {
      label: 'Followers',
      value: profile?.followerCount ?? 0,
      onPress: () => router.push(`/user/${user.id}`),
    },
    {
      label: 'Following',
      value: profile?.followingCount ?? 0,
      onPress: () => router.push(`/user/${user.id}`),
    },
    { label: 'Saved', value: savedBoards.length, onPress: () => setTab('saved') },
  ];

  const emptyText =
    tab === 'saved'
      ? 'Boards you save will live here.'
      : tab === 'trips'
        ? 'No itinerary trips yet — create one from the New Board tile.'
        : 'No boards yet — start with the New Board tile below.';

  const header = (
    <View style={styles.header}>
      {/* Identity block: avatar + edit, name, handle, bio */}
      <Reveal style={styles.identityRow}>
        <Pressable onPress={() => void pickAvatar()} style={styles.avatarWrap}>
          <Avatar uri={user.avatarUrl} name={user.name} size={76} />
          <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
            <Ionicons name="camera" size={13} color={theme.onPrimary} />
          </View>
        </Pressable>
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <ThemedText type="subtitle" style={styles.name} numberOfLines={1}>
              {user.name}
            </ThemedText>
            <View style={[styles.creatorBadge, { backgroundColor: theme.primaryContainer }]}>
              <ThemedText type="smallBold" style={{ color: theme.primaryDark, fontSize: 10, letterSpacing: 0.6 }}>
                CREATOR
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            @{handle}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.editBtn,
            { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="create-outline" size={14} color={theme.text} />
          <ThemedText type="smallBold" style={{ fontSize: 12 }}>Edit Profile</ThemedText>
        </Pressable>
      </Reveal>

      {user.bio ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
          {user.bio}
        </ThemedText>
      ) : null}
      {avatarError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>{avatarError}</ThemedText>
      ) : null}

      {/* Stats row */}
      <Reveal delay={80} style={styles.statsRow}>
        {stats.map((s) => (
          <Pressable key={s.label} onPress={s.onPress} style={styles.stat} hitSlop={4}>
            <ThemedText type="subtitle" style={styles.statValue}>
              {formatCount(s.value)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
              {s.label}
            </ThemedText>
          </Pressable>
        ))}
      </Reveal>

      {/* Active trip banner */}
      {activeTrip ? (
        <Reveal delay={140}>
          <Pressable
            onPress={() => router.push(`/board/${activeTrip.board.id}`)}
            style={({ pressed }) => [
              styles.tripCard,
              { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
              Shadows.card,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.tripTop}>
              <View style={styles.tripLabel}>
                <View style={[styles.tripDot, { backgroundColor: theme.tertiary }]} />
                <ThemedText type="smallBold" style={{ color: theme.tertiary, letterSpacing: 0.8, fontSize: 11 }}>
                  ACTIVE TRIP
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Day {activeTrip.day} of {activeTrip.total}
              </ThemedText>
            </View>
            <View style={styles.tripMain}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.tripTitle}>
                  {activeTrip.board.title}
                </ThemedText>
                <View style={styles.tripMeta}>
                  <Ionicons name="people-outline" size={13} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.max((activeTrip.board.memberCount ?? 1) - 1, 0)} collaborators ·{' '}
                    {activeTrip.board.destination ?? 'No destination'}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.liveRoute, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="map-outline" size={14} color={theme.primary} />
                <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 12 }}>Open board</ThemedText>
              </View>
            </View>
          </Pressable>
        </Reveal>
      ) : null}

      {/* Segmented tabs */}
      <Reveal delay={200} style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          const count =
            t.key === 'boards' ? myBoards.length : t.key === 'saved' ? savedBoards.length : trips.length;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.segmentItem,
                active && { backgroundColor: theme.surfaceCard, ...Shadows.card },
              ]}
            >
              <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                {t.label} {count}
              </ThemedText>
            </Pressable>
          );
        })}
      </Reveal>

      {cards.length <= (tab === 'boards' ? 1 : 0) ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
          {emptyText}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Premium large header */}
      <ScreenHeader
        variant="large"
        title="Profile"
        actions={
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </Pressable>
        }
      />

      <FlashList
        data={cards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.id === NEW_TILE ? (
            <View style={styles.cell}>
              <Pressable
                onPress={() => router.push('/board/create')}
                style={({ pressed }) => [
                  styles.newTile,
                  { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceCard },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.newIcon, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="add" size={22} color={theme.text} />
                </View>
                <ThemedText type="smallBold">New Board</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.newTileSub}>
                  Curate your next trip
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cell}>
              <BoardCard board={item} onPress={() => router.push(`/board/${item.id}`)} />
            </View>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: { paddingHorizontal: Spacing.three, paddingTop: 0 },
  cell: { padding: Spacing.half, flex: 1 },

  header: { paddingBottom: Spacing.two, gap: Spacing.three },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  avatarWrap: { width: 76, height: 76 },
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
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  creatorBadge: {
    paddingHorizontal: Spacing.two - 2,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 1,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  bio: { lineHeight: 18 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11 },

  tripCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tripLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  tripDot: { width: 7, height: 7, borderRadius: 4 },
  tripMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tripTitle: { fontSize: 14 },
  tripMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  liveRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: Radius.full,
  },

  segment: {
    flexDirection: 'row',
    padding: Spacing.half,
    borderRadius: Radius.full,
    backgroundColor: 'transparent',
    gap: Spacing.one,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.three },

  newTile: {
    flex: 1,
    minHeight: 200,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  newTileSub: { textAlign: 'center', fontSize: 11 },
});
