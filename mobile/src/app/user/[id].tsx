import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardCard, type BoardCardModel } from '@/components/board-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { SearchUser, UserBoardFeedItem } from '@/lib/types';

function toCardModel(board: UserBoardFeedItem): BoardCardModel {
  return {
    id: board.id,
    coverImageUrl: board.coverImageUrl,
    title: board.title,
    destination: board.destination,
    badge: board.boardType === 'ITINERARY' ? 'Itinerary' : null,
    meta: `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'} · ${board.likeCount} likes`,
  };
}

type Tab = 'boards' | 'followers' | 'following';

function UserRow({
  user,
  onPress,
}: {
  user: SearchUser;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.userRow, { borderColor: theme.backgroundSelected }]}
    >
      <View style={[styles.userAvatar, { backgroundColor: theme.backgroundElement }]}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <ThemedText type="smallBold" themeColor="textSecondary">
            {user.name.slice(0, 2).toUpperCase()}
          </ThemedText>
        )}
      </View>
      <View style={styles.userInfo}>
        <ThemedText type="smallBold">{user.name}</ThemedText>
      </View>
    </Pressable>
  );
}

export default function UserProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('boards');

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.getProfile(id ?? ''),
    enabled: Boolean(id),
  });

  const boardsQuery = useQuery({
    queryKey: ['userBoards', id],
    queryFn: () => api.getUserBoards(id ?? '', 50, 0),
    enabled: Boolean(id) && tab === 'boards',
  });

  const followersQuery = useQuery({
    queryKey: ['followers', id],
    queryFn: () => api.getUserFollowers(id ?? ''),
    enabled: Boolean(id) && tab === 'followers',
  });

  const followingQuery = useQuery({
    queryKey: ['following', id],
    queryFn: () => api.getUserFollowing(id ?? ''),
    enabled: Boolean(id) && tab === 'following',
  });

  const profile = profileQuery.data?.user;

  const handleFollow = async () => {
    if (!profile) return;
    try {
      await api.toggleFollowUser(profile.id, profile.isFollowing ?? false);
      profileQuery.refetch();
    } catch {
      // silent
    }
  };

  const handleStartChat = async () => {
    if (!profile) return;
    try {
      const conv = await api.createDirectConversation(profile.id);
      router.push(`/chat/${conv.id}`);
    } catch {
      // silent
    }
  };

  const notFound = profileQuery.error instanceof ApiError && profileQuery.error.status === 404;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold">←</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
          {profile?.name ?? 'Profile'}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {profileQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : notFound ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">User not found</ThemedText>
        </View>
      ) : profile ? (
        <>
          {/* Profile header is always rendered above the tab content */}
          <FlashList
            data={
              tab === 'boards'
                ? (boardsQuery.data?.items ?? [])
                : []
            }
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BoardCard
                board={toCardModel(item)}
                onPress={() => router.push(`/board/${item.id}`)}
              />
            )}
            numColumns={2}
            ListHeaderComponent={
              <View style={styles.profileHeader}>
                {/* Avatar + name */}
                <View style={styles.avatarRow}>
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                    {profile.avatarUrl ? (
                      <Image source={{ uri: profile.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <ThemedText type="subtitle" themeColor="textSecondary">
                        {profile.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.nameCol}>
                    <ThemedText type="subtitle">{profile.name}</ThemedText>
                    {profile.bio ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
                        {profile.bio}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                  {[
                    { label: 'boards', value: profile.publicBoardCount },
                    { label: 'followers', value: profile.followerCount },
                    { label: 'following', value: profile.followingCount },
                  ].map((s) => (
                    <View key={s.label} style={styles.stat}>
                      <ThemedText type="smallBold">{s.value}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{s.label}</ThemedText>
                    </View>
                  ))}
                </View>

                {/* Actions */}
                {!profile.isMe ? (
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={handleFollow}
                      style={[
                        styles.followBtn,
                        {
                          backgroundColor: profile.isFollowing ? theme.backgroundElement : theme.text,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: profile.isFollowing ? theme.text : theme.background }}
                      >
                        {profile.isFollowing ? 'Following' : 'Follow'}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleStartChat}
                      style={[styles.chatBtn, { borderColor: theme.backgroundSelected }]}
                    >
                      <ThemedText type="smallBold">Message</ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                {/* Tabs */}
                <View style={[styles.tabRow, { borderColor: theme.backgroundSelected }]}>
                  {(['boards', 'followers', 'following'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setTab(t)}
                      style={[styles.tab, tab === t && { borderBottomColor: theme.text }]}
                    >
                      <ThemedText
                        type="smallBold"
                        themeColor={tab === t ? 'text' : 'textSecondary'}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
            ListEmptyComponent={
              !boardsQuery.isLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No public boards yet.
                </ThemedText>
              ) : null
            }
            style={tab !== 'boards' ? { display: 'none' } : undefined}
          />
          {tab !== 'boards' && (
            <FlashList
              data={
                tab === 'followers'
                  ? (followersQuery.data?.items ?? [])
                  : (followingQuery.data?.items ?? [])
              }
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <UserRow
                  user={item}
                  onPress={() => router.push(`/user/${item.id}`)}
                />
              )}
              numColumns={1}
              ListHeaderComponent={
                <View style={styles.profileHeader}>
                  <View style={styles.avatarRow}>
                    <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                      {profile.avatarUrl ? (
                        <Image source={{ uri: profile.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <ThemedText type="subtitle" themeColor="textSecondary">
                          {profile.name.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.nameCol}>
                      <ThemedText type="subtitle">{profile.name}</ThemedText>
                      {profile.bio ? (
                        <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
                          {profile.bio}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    {[
                      { label: 'boards', value: profile.publicBoardCount },
                      { label: 'followers', value: profile.followerCount },
                      { label: 'following', value: profile.followingCount },
                    ].map((s) => (
                      <View key={s.label} style={styles.stat}>
                        <ThemedText type="smallBold">{s.value}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{s.label}</ThemedText>
                      </View>
                    ))}
                  </View>

                  {!profile.isMe ? (
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={handleFollow}
                        style={[
                          styles.followBtn,
                          {
                            backgroundColor: profile.isFollowing ? theme.backgroundElement : theme.text,
                            borderColor: theme.backgroundSelected,
                          },
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: profile.isFollowing ? theme.text : theme.background }}
                        >
                          {profile.isFollowing ? 'Following' : 'Follow'}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={handleStartChat}
                        style={[styles.chatBtn, { borderColor: theme.backgroundSelected }]}
                      >
                        <ThemedText type="smallBold">Message</ThemedText>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={[styles.tabRow, { borderColor: theme.backgroundSelected }]}>
                    {(['boards', 'followers', 'following'] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setTab(t)}
                        style={[styles.tab, tab === t && { borderBottomColor: theme.text }]}
                      >
                        <ThemedText
                          type="smallBold"
                          themeColor={tab === t ? 'text' : 'textSecondary'}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              }
              contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
              ListEmptyComponent={
                !followersQuery.isLoading && !followingQuery.isLoading ? (
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    {tab === 'followers'
                      ? 'No followers yet.'
                      : 'Not following anyone yet.'}
                  </ThemedText>
                ) : null
              }
            />
          )}
        </>
      ) : null}
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
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1 },
  headerSpacer: { width: Spacing.five },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one, gap: Spacing.three },
  profileHeader: { gap: Spacing.three, marginBottom: Spacing.three },
  avatarRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 64,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: { flex: 1, gap: Spacing.one },
  bio: { lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: Spacing.four },
  stat: { alignItems: 'center', gap: 2 },
  actionsRow: { flexDirection: 'row', gap: Spacing.two },
  followBtn: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
  },
  chatBtn: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.four },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1, gap: 2 },
});
