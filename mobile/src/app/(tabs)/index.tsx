import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BoardCard, durationLabel, type BoardCardModel } from '@/components/board-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip } from '@/components/ui/pill-button';
import { MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { FeedItem, MyBoard } from '@/lib/types';

const PAGE_SIZE = 20;
/** Vary tile heights to produce the staggered masonry look. */
const ASPECT_RATIOS = [0.8, 1.0, 0.72, 0.85, 1.0, 0.78];

type Scope = 'foryou' | 'trending' | 'following' | 'mine';

function fromFeedItem(item: FeedItem, index: number): BoardCardModel {
  return {
    id: item.id,
    coverImageUrl: item.coverImageUrl,
    title: item.title,
    destination: item.destination,
    durationLabel: durationLabel(item),
    owner: { name: item.owner.name, avatarUrl: item.owner.avatarUrl },
    likeCount: item.likeCount,
    saveCount: item.saveCount,
    aspectRatio: ASPECT_RATIOS[index % ASPECT_RATIOS.length],
  };
}

function fromMyBoard(board: MyBoard, index: number): BoardCardModel {
  return {
    id: board.id,
    coverImageUrl: board.coverImageUrl,
    title: board.title,
    destination: board.destination,
    badge: board.visibility === 'PRIVATE' ? 'Private' : null,
    owner: null,
    meta: `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'} · ${
      board.role?.toLowerCase() ?? 'member'
    }`,
    aspectRatio: ASPECT_RATIOS[index % ASPECT_RATIOS.length],
  };
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Full-width promo tile encouraging shared group trips. */
function SharedBoardsPromo() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/board/create')}
      style={({ pressed }) => [
        styles.promo,
        { backgroundColor: theme.primaryContainer, borderColor: theme.borderSubtle },
        Shadows.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.promoIcon, { backgroundColor: theme.primary }]}>
        <Ionicons name="people" size={20} color={theme.onPrimary} />
      </View>
      <ThemedText type="smallBold" style={styles.promoTitle}>
        Shared Boards
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.promoBody}>
        Plan seamless group trips with shared boards.
      </ThemedText>
      <View style={[styles.promoBtn, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }]}>
        <MaterialIcons name="person-add-alt" size={14} color={theme.primary} />
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          Invite Travelers
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>('foryou');
  const [search, setSearch] = useState('');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: api.me });
  const unreadQuery = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const firstName = (meQuery.data?.user.name ?? '').split(' ')[0] || 'traveler';

  const feedQuery = useInfiniteQuery({
    queryKey: ['home', scope, search],
    queryFn: ({ pageParam }): Promise<{ items: FeedItem[]; hasMore: boolean }> => {
      const offset = (pageParam as number) ?? 0;
      if (scope === 'mine') {
        return api.getMyBoards().then((boards) => ({ items: boards as unknown as FeedItem[], hasMore: false }));
      }
      if (scope === 'following') {
        return api.getFollowingFeed(PAGE_SIZE, offset);
      }
      return api.getExplore(scope === 'trending' ? 'trending' : 'newest', PAGE_SIZE, offset, search || undefined);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
  });

  // Flatten pages into a stable array (memoized) so downstream memos don't
  // recompute on every render.
  const rawItems = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );
  const cards = useMemo(
    () =>
      rawItems.map((item, index) =>
        scope === 'mine'
          ? fromMyBoard(item as unknown as MyBoard, index)
          : fromFeedItem(item, index),
      ),
    [rawItems, scope],
  );

  // True 2-column masonry: send each tile to whichever column is shorter.
  const { left, right } = useMemo(() => {
    const columns: BoardCardModel[][] = [[], []];
    const heights = [0, 0];
    for (const card of cards) {
      const target = heights[0] <= heights[1] ? 0 : 1;
      columns[target]!.push(card);
      heights[target] += 1 / (card.aspectRatio ?? 0.8) + 0.25;
    }
    // Drop the promo tile into the shorter column near the top.
    return { left: columns[0]!, right: columns[1]! };
  }, [cards]);

  const openNotifications = useCallback(() => router.push('/notifications'), [router]);
  const openProfile = useCallback(() => router.push('/settings'), [router]);

  const renderColumn = (column: BoardCardModel[], withPromo: boolean) => (
    <View style={styles.column}>
      {withPromo ? <SharedBoardsPromo /> : null}
      {column.map((card) => (
        <BoardCard
          key={card.id}
          board={card}
          onPress={() => router.push(`/board/${card.id}`)}
          saved={false}
          onSave={() => {
            void api.toggleBoardSave(card.id).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['home'] });
            });
          }}
        />
      ))}
    </View>
  );

  const isEmpty = !feedQuery.isLoading && cards.length === 0;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feedQuery.isRefetching}
              onRefresh={() => feedQuery.refetch()}
              tintColor={theme.textSecondary}
            />
          }
        >
          {/* Brand header */}
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={require('../../../assets/images/logo.png')} style={styles.brandLogo} contentFit="contain" />
              <View>
                <ThemedText type="smallBold" style={styles.brandName}>
                  TravelBoard
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
                  Pin it. Plan it. Live it.
                </ThemedText>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={openNotifications}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
              >
                <MaterialIcons name="notifications-none" size={22} color={theme.text} />
                {unreadCount > 0 ? (
                  <View style={[styles.dot, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.dotText, { color: theme.onPrimary }]}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
              <Pressable onPress={openProfile} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <Avatar uri={meQuery.data?.user.avatarUrl} name={firstName} size={36} />
              </Pressable>
            </View>
          </View>

          {/* Greeting */}
          <View style={styles.greeting}>
            <ThemedText type="title" style={styles.greetingText}>
              {greetingForHour(new Date().getHours())}, {firstName} 👋
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              What will inspire you today?
            </ThemedText>
          </View>

          {/* Search */}
          <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle }]}>
            <MaterialIcons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search destinations, secret spots, food…"
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label="For You" active={scope === 'foryou'} onPress={() => setScope('foryou')} />
            <Chip label="Trending" active={scope === 'trending'} onPress={() => setScope('trending')} />
            <Chip label="Following" active={scope === 'following'} onPress={() => setScope('following')} />
            <Chip label="My Boards" active={scope === 'mine'} onPress={() => setScope('mine')} />
          </ScrollView>

          {/* Masonry feed */}
          {feedQuery.isError ? (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Couldn&apos;t load your feed. Check that the API is running.
            </ThemedText>
          ) : isEmpty ? (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {scope === 'mine'
                ? 'You have no boards yet — tap + to create one.'
                : scope === 'following'
                  ? 'Follow someone to see their boards here.'
                  : 'No boards to show yet.'}
            </ThemedText>
          ) : (
            <View style={styles.masonry}>
              {renderColumn(left, left.length > 0)}
              {renderColumn(right, false)}
            </View>
          )}

          {feedQuery.isLoading ? (
            <ActivityIndicator style={styles.loader} color={theme.textSecondary} />
          ) : null}

          {!isEmpty && !feedQuery.isError ? (
            <View style={styles.caughtUp}>
              <View style={[styles.caughtUpLine, { backgroundColor: theme.borderSubtle }]} />
              <MaterialIcons name="all-inclusive" size={16} color={theme.textSecondary} />
              <View style={[styles.caughtUpLine, { backgroundColor: theme.borderSubtle }]} />
            </View>
          ) : null}
          {!isEmpty && !feedQuery.isError ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.caughtUpText}>
              YOU&apos;RE ALL CAUGHT UP ✨
            </ThemedText>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  scrollContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandLogo: { width: 32, height: 32, borderRadius: 8 },
  brandName: { fontSize: 16, lineHeight: 20, fontWeight: '800', letterSpacing: -0.3 },
  tagline: { fontSize: 11, lineHeight: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontSize: 9, lineHeight: 12, fontWeight: '700' },
  greeting: { marginTop: Spacing.three, gap: Spacing.half },
  greetingText: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { gap: Spacing.two, paddingVertical: Spacing.three },
  masonry: { flexDirection: 'row', gap: Spacing.two },
  column: { flex: 1, gap: Spacing.two },
  promo: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.half,
  },
  promoTitle: { fontSize: 15, fontWeight: '800' },
  promoBody: { lineHeight: 18 },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    marginTop: Spacing.one,
  },
  centerText: { textAlign: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  loader: { paddingVertical: Spacing.four },
  caughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  caughtUpLine: { flex: 1, height: StyleSheet.hairlineWidth },
  caughtUpText: {
    textAlign: 'center',
    letterSpacing: 1,
    fontSize: 11,
    marginTop: Spacing.two,
  },
});
