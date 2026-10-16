import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BoardCard, type BoardCardModel } from '@/components/board-card';
import { GlassButton } from '@/components/premium/glass';
import { Dissolve, Reveal } from '@/components/premium/motion';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import type { PublicProfile, SearchUser, UserBoardFeedItem } from '@/lib/types';

function toCardModel(board: UserBoardFeedItem): BoardCardModel {
  return {
    id: board.id,
    coverImageUrl: board.coverImageUrl,
    title: board.title,
    destination: board.destination,
    badge: board.boardType === 'ITINERARY' ? 'Itinerary' : null,
    owner: null,
    meta: `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'} · ♥ ${board.likeCount}`,
  };
}

type Tab = 'boards' | 'followers' | 'following';

const TABS: { key: Tab; label: string }[] = [
  { key: 'boards', label: 'Boards' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
];

function UserRow({ user, onPress }: { user: SearchUser; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.userRow,
        { borderColor: theme.borderSubtle, backgroundColor: pressed ? theme.backgroundElement : theme.surfaceCard },
      ]}
    >
      <Avatar uri={user.avatarUrl} name={user.name} size={44} />
      <View style={styles.userInfo}>
        <ThemedText type="smallBold">{user.name}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Premium profile header: tinted hero band, ringed avatar, stats, actions, tabs. */
function ProfileHeader({
  profile,
  tab,
  onTab,
  onFollow,
  onChat,
}: {
  profile: PublicProfile;
  tab: Tab;
  onTab: (t: Tab) => void;
  onFollow: () => void;
  onChat: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.headerWrap}>
      {/* Hero band */}
      <Dissolve style={styles.heroBand} color={theme.primary} speed={0.35} intensity={0.8}>
        <View style={styles.heroSpacer} />
      </Dissolve>

      <View style={styles.headerContent}>
        {/* Avatar with ring */}
        <Reveal style={styles.avatarRing}>
          <View style={[styles.ring, { borderColor: theme.primary }]}>
            <Avatar uri={profile.avatarUrl} name={profile.name} size={84} />
          </View>
        </Reveal>

        <Reveal delay={80} style={styles.nameBlock}>
          <ThemedText type="subtitle" style={styles.name}>
            {profile.name}
          </ThemedText>
          {profile.bio ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
              {profile.bio}
            </ThemedText>
          ) : null}
          {profile.isMe ? (
            <View style={[styles.youBadge, { backgroundColor: theme.primaryContainer }]}>
              <Ionicons name="sparkles" size={11} color={theme.primaryDark} />
              <ThemedText type="smallBold" style={{ color: theme.primaryDark, fontSize: 11 }}>
                Your profile
              </ThemedText>
            </View>
          ) : null}
        </Reveal>

        {/* Stat cards */}
        <Reveal delay={140} style={styles.statsRow}>
          {[
            { label: 'Boards', value: profile.publicBoardCount, icon: 'grid-outline' as const },
            { label: 'Followers', value: profile.followerCount, icon: 'people-outline' as const },
            { label: 'Following', value: profile.followingCount, icon: 'person-add-outline' as const },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }, Shadows.card]}>
              <Ionicons name={s.icon} size={16} color={theme.primary} />
              <ThemedText type="smallBold" style={styles.statValue}>
                {s.value}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                {s.label}
              </ThemedText>
            </View>
          ))}
        </Reveal>

        {/* Actions */}
        {!profile.isMe ? (
          <Reveal delay={200} style={styles.actionsRow}>
            <Pressable
              onPress={onFollow}
              style={({ pressed }) => [
                styles.followBtn,
                {
                  backgroundColor: profile.isFollowing ? theme.backgroundElement : theme.primary,
                  borderColor: profile.isFollowing ? theme.borderSubtle : 'transparent',
                },
                !profile.isFollowing && Shadows.fab,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={profile.isFollowing ? 'checkmark' : 'person-add'}
                size={16}
                color={profile.isFollowing ? theme.text : theme.onPrimary}
              />
              <ThemedText type="smallBold" style={{ color: profile.isFollowing ? theme.text : theme.onPrimary }}>
                {profile.isFollowing ? 'Following' : 'Follow'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onChat}
              style={({ pressed }) => [
                styles.chatBtn,
                { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="chatbubble-outline" size={16} color={theme.text} />
              <ThemedText type="smallBold">Message</ThemedText>
            </Pressable>
          </Reveal>
        ) : null}

        {/* Segmented tabs */}
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => onTab(t.key)}
                style={[styles.segmentItem, active && { backgroundColor: theme.surfaceCard, ...Shadows.card }]}
              >
                <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
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

  // Shared header rendered once above whichever list is active.
  const header = profile ? (
    <ProfileHeader
      profile={profile}
      tab={tab}
      onTab={setTab}
      onFollow={() => void handleFollow()}
      onChat={() => void handleStartChat()}
    />
  ) : null;

  const boardItems: BoardCardModel[] = (boardsQuery.data?.items ?? []).map(toCardModel);
  const people: SearchUser[] =
    tab === 'followers'
      ? (followersQuery.data?.items ?? [])
      : (followingQuery.data?.items ?? []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Floating back */}
      <View style={styles.topBar}>
        <GlassButton onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name={Platform.OS === 'android' ? 'arrow-forward' : 'chevron-back'} size={22} color={theme.text} />
        </GlassButton>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.topTitle}>
          {profile?.name ?? 'Profile'}
        </ThemedText>
        <View style={styles.topSpacer} />
      </View>

      {profileQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : notFound ? (
        <View style={styles.center}>
          <Ionicons name="person-remove-outline" size={32} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary">User not found</ThemedText>
        </View>
      ) : profile ? (
        tab === 'boards' ? (
          <FlashList
            data={boardItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BoardCard board={item} onPress={() => router.push(`/board/${item.id}`)} />
            )}
            numColumns={2}
            ListHeaderComponent={header}
            contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
            ListEmptyComponent={
              !boardsQuery.isLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No public boards yet.
                </ThemedText>
              ) : null
            }
          />
        ) : (
          <FlashList
            data={people}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <UserRow user={item} onPress={() => router.push(`/user/${item.id}`)} />}
            numColumns={1}
            ListHeaderComponent={header}
            contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
            ListEmptyComponent={
              !followersQuery.isLoading && !followingQuery.isLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                </ThemedText>
              ) : null
            }
          />
        )
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  topSpacer: { width: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  listContent: { paddingHorizontal: Spacing.three, gap: Spacing.three, paddingTop: 0 },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.four },

  // Header
  headerWrap: { marginBottom: Spacing.three },
  heroBand: {
    height: 96,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    marginHorizontal: -Spacing.three,
    overflow: 'hidden',
  },
  heroSpacer: { flex: 1 },
  headerContent: { alignItems: 'center', marginTop: -44, gap: Spacing.two },
  avatarRing: { padding: 4 },
  ring: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  nameBlock: { alignItems: 'center', gap: Spacing.half, marginTop: Spacing.one },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  bio: { textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.four },
  youBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.full,
    marginTop: Spacing.one,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two, width: '100%' },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingVertical: Spacing.two + Spacing.half,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingVertical: Spacing.two + Spacing.half,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  segment: {
    flexDirection: 'row',
    marginTop: Spacing.three,
    padding: Spacing.half,
    borderRadius: Radius.full,
    gap: Spacing.one,
    width: '100%',
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two + Spacing.half,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  userInfo: { flex: 1 },
});
