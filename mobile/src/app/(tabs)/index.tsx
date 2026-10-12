import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { BoardCard, type BoardCardModel } from '@/components/board-card';
import { Chip, PillButton } from '@/components/ui/pill-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { MyBoard } from '@/lib/types';

function toCardModel(board: MyBoard): BoardCardModel {
  return {
    id: board.id,
    coverImageUrl: board.coverImageUrl,
    title: board.title,
    destination: board.destination,
    badge: board.visibility === 'PRIVATE' ? 'Private' : null,
    meta: `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'} · ${board.role?.toLowerCase() ?? 'member'}`,
  };
}

// ── My boards list ─────────────────────────────────────────────────────────

function MyBoardsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const signOut = useAuthStore((state) => state.signOut);
  const [scope, setScope] = useState<'mine' | 'saved'>('mine');

  const query = useQuery({
    queryKey: ['boards', scope],
    queryFn: scope === 'mine' ? api.getMyBoards : api.getSavedBoards,
  });

  const unreadQuery = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;

  const cards = (query.data ?? []).map(toCardModel);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  const openCreate = useCallback(() => {
    router.push('/board/create');
  }, [router]);

  const openNotifications = useCallback(() => {
    router.push('/notifications');
  }, [router]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="subtitle">My Boards</ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            onPress={openNotifications}
            style={({ pressed }) => [
              styles.bellButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.bellPressed,
            ]}
          >
            <MaterialIcons name="notifications" size={20} color={theme.text} />
            {unreadCount > 0 ? (
              <View style={[styles.bellBadge, { backgroundColor: theme.primary }]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.bellBadgeText, { color: theme.onPrimary }]}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
          <PillButton
            label="New"
            onPress={openCreate}
            variant="secondary"
            compact
          />
          <PillButton
            label="Sign out"
            onPress={handleSignOut}
            variant="ghost"
            compact
          />
        </View>
      </View>

      {/* Owned/shared vs saved boards */}
      <View style={styles.scopeRow}>
        <Chip
          label="Mine"
          active={scope === 'mine'}
          onPress={() => setScope('mine')}
        />
        <Chip
          label="Saved"
          active={scope === 'saved'}
          onPress={() => setScope('saved')}
        />
      </View>

      {query.isError && !(query.error instanceof ApiError && query.error.status === 401) ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Couldn&apos;t load your boards. Check that the API is running.
          </ThemedText>
          <PillButton label="Retry" onPress={() => query.refetch()} />
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
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            query.isLoading ? null : (
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {scope === 'saved'
                  ? 'Boards you save appear here. Tap ☆ on any board.'
                  : "You don't have any boards yet. Tap New to create one."}
              </ThemedText>
            )
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

export default function HomeScreen() {
  return <MyBoardsScreen />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
  },
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellPressed: {
    opacity: 0.7,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 10,
    lineHeight: 14,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
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
});
