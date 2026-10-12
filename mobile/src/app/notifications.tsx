import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/ui/pill-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { UI_MESSAGES } from '@travel-board/shared';
import type { NotificationItem } from '@/lib/types';

const PAGE_SIZE = 30;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w ago`;
  return `${Math.floor(weeks / 52)}y ago`;
}

/** One-line sentence per notification type (mirrors backend push copy). */
function notificationSentence(item: NotificationItem): string {
  const name = item.actor.name;
  const boardTitle =
    typeof item.metadata?.['boardTitle'] === 'string'
      ? (item.metadata['boardTitle'] as string)
      : null;
  const excerpt =
    typeof item.metadata?.['excerpt'] === 'string'
      ? (item.metadata['excerpt'] as string)
      : null;

  switch (item.type) {
    case 'NEW_FOLLOWER':
      return `${name} started following you`;
    case 'NEW_BOARD_FOLLOWER':
      return boardTitle
        ? `${name} is now following ${boardTitle}`
        : `${name} is following one of your boards`;
    case 'NEW_COMMENT':
      return boardTitle
        ? `${name} commented on ${boardTitle}`
        : `${name} left a comment`;
    case 'NEW_LIKE':
      return boardTitle
        ? `${name} liked ${boardTitle}`
        : `${name} liked something of yours`;
    case 'NEW_SAVE':
      return boardTitle
        ? `${name} saved ${boardTitle}`
        : `${name} saved something of yours`;
    case 'NEW_CHAT_MESSAGE':
      return excerpt ?? 'You have a new message';
    case 'MENTION':
    default:
      return `${name} mentioned you`;
  }
}

/** Deep-link target for a tapped notification. */
function notificationRoute(item: NotificationItem): Href | null {
  switch (item.type) {
    case 'NEW_FOLLOWER':
      return `/user/${item.actor.id}`;
    case 'NEW_CHAT_MESSAGE':
      return item.targetId ? `/chat/${item.targetId}` : null;
    case 'NEW_BOARD_FOLLOWER':
    case 'NEW_COMMENT':
    case 'NEW_LIKE':
    case 'NEW_SAVE':
      return item.targetId ? `/board/${item.targetId}` : null;
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(PAGE_SIZE, 0),
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  const items = query.data?.items ?? [];
  const hasUnread = items.some((item) => !item.read);

  const handleTap = (item: NotificationItem) => {
    if (!item.read) {
      markReadMutation.mutate([item.id]);
    }
    const route = notificationRoute(item);
    if (route) {
      router.push(route);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="subtitle" themeColor="textSecondary">
              ‹ Back
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Notifications</ThemedText>
        </View>
        {hasUnread ? (
          <PillButton
            label={UI_MESSAGES.NOTIFICATIONS.MARK_ALL_READ}
            onPress={() => markAllReadMutation.mutate()}
            variant="ghost"
            compact
          />
        ) : null}
      </View>

      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleTap(item)}
            style={[styles.row, { borderColor: theme.backgroundSelected }]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              {item.actor.avatarUrl ? (
                <Image
                  source={{ uri: item.actor.avatarUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {item.actor.name.slice(0, 2).toUpperCase()}
                </ThemedText>
              )}
            </View>
            <View style={styles.body}>
              <ThemedText
                type="small"
                themeColor={item.read ? 'textSecondary' : 'text'}
                numberOfLines={2}
              >
                {notificationSentence(item)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {timeAgo(item.createdAt)}
              </ThemedText>
            </View>
            {!item.read ? (
              <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
            ) : null}
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          query.isLoading ? null : (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {UI_MESSAGES.NOTIFICATIONS.EMPTY}
            </ThemedText>
          )
        }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
