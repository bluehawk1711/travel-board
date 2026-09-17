import { useInfiniteQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BoardCard, type BoardCardModel } from '@/components/board-card';
import { Chip, PillButton } from '@/components/ui/pill-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { FeedItem, FeedSort } from '@/lib/types';

const PAGE_SIZE = 20;

function toCardModel(item: FeedItem): BoardCardModel {
  return {
    id: item.id,
    coverImageUrl: item.coverImageUrl,
    title: item.title,
    destination: item.destination,
    badge: item.boardType === 'ITINERARY' ? 'Itinerary' : null,
    meta: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'} · ♥ ${item.likeCount} · ★ ${item.saveCount}`,
  };
}

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [sort, setSort] = useState<FeedSort>('newest');

  const query = useInfiniteQuery({
    queryKey: ['explore', sort],
    queryFn: ({ pageParam }) => api.getExplore(sort, PAGE_SIZE, (pageParam as number) ?? 0),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
  });

  const cards = (query.data?.pages.flatMap((page) => page.items) ?? []).map(
    toCardModel,
  );

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Explore</ThemedText>
        <View style={styles.sortRow}>
          <Chip
            label="Newest"
            active={sort === 'newest'}
            onPress={() => setSort('newest')}
          />
          <Chip
            label="Trending"
            active={sort === 'trending'}
            onPress={() => setSort('trending')}
          />
        </View>
      </View>

      {query.isError ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Couldn&apos;t load the explore feed. Check that the API is running.
          </ThemedText>
          <PillButton
            label="Retry"
            onPress={() => query.refetch()}
            variant="secondary"
          />
        </View>
      ) : (
        <FlashList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <BoardCard
                board={item}
                onPress={() => router.push(`/board/${item.id}`)}
              />
            </View>
          )}
          numColumns={2}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: BottomTabInset + Spacing.four },
          ]}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            query.isLoading ? null : (
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                No boards here yet — be the first to create one.
              </ThemedText>
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator
                style={styles.footer}
                color={theme.textSecondary}
              />
            ) : null
          }
        />
      )}

      {query.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
  cell: {
    padding: Spacing.one + Spacing.half,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    paddingVertical: Spacing.three,
  },
});