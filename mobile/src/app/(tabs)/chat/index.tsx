import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/premium/screen-header';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { ConversationSummary } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2:41 PM" today, weekday this week, otherwise "Oct 12". */
function formatWhen(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 6) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

type Row =
  | { kind: 'header'; id: string; label: string; count: number }
  | { kind: 'conv'; id: string; conv: ConversationSummary };

function SectionHeader({ label, count }: { label: string; count: number }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHead}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <View style={[styles.countPill, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 10 }}>
          {count}
        </ThemedText>
      </View>
    </View>
  );
}

export default function ChatListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: api.getConversations,
  });
  const meQuery = useQuery({ queryKey: ['me'], queryFn: api.me });
  const myId = meQuery.data?.user.id;

  const conversations = useMemo(() => query.data ?? [], [query.data]);

  // Fetch presence for every distinct "other" participant in one request.
  const otherUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conv of conversations) {
      for (const member of conv.members) {
        if (member.userId !== myId) {
          ids.add(member.userId);
        }
      }
    }
    return [...ids];
  }, [conversations, myId]);

  const presenceQuery = useQuery({
    queryKey: ['presence', otherUserIds.sort().join(',')],
    queryFn: () => api.getPresence(otherUserIds),
    enabled: otherUserIds.length > 0,
    refetchInterval: 30_000,
  });
  const presence = presenceQuery.data ?? {};

  // Groups first (board + group chats), then individual people — each with its
  // own header so the list reads at a glance (reference: grouped inbox).
  const rows = useMemo<Row[]>(() => {
    const groups = conversations.filter((c) => c.type !== 'DIRECT');
    const people = conversations.filter((c) => c.type === 'DIRECT');
    const out: Row[] = [];
    if (groups.length > 0) {
      out.push({ kind: 'header', id: 'hdr-groups', label: 'Groups', count: groups.length });
      for (const conv of groups) out.push({ kind: 'conv', id: conv.id, conv });
    }
    if (people.length > 0) {
      out.push({ kind: 'header', id: 'hdr-people', label: 'People', count: people.length });
      for (const conv of people) out.push({ kind: 'conv', id: conv.id, conv });
    }
    return out;
  }, [conversations]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        variant="large"
        title="Messages"
        subtitle="Your trip groups and conversations"
      />

      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <SectionHeader label={item.label} count={item.count} />;
          }
          const conv = item.conv;
          const isGroup = conv.type !== 'DIRECT';
          // DIRECT conversations have name=null — the other participant is
          // the first member who isn't me. GROUP/BOARD use their own name.
          const other = conv.members.find((m) => m.userId !== myId);
          const displayName = conv.name ?? other?.name ?? 'Conversation';
          const avatarUrl = other?.avatarUrl ?? null;
          const when = formatWhen(conv.lastMessage?.createdAt);
          const unread = conv.unreadCount ?? 0;

          return (
            <Pressable
              onPress={() => router.push(`/chat/${conv.id}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: theme.backgroundSelected,
                  backgroundColor: pressed ? theme.backgroundElement : 'transparent',
                },
              ]}
            >
              <View style={styles.avatarWrap}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isGroup ? theme.primaryContainer : theme.backgroundElement },
                  ]}
                >
                  {isGroup ? (
                    <Ionicons
                      name={conv.type === 'BOARD' ? 'grid-outline' : 'people-outline'}
                      size={22}
                      color={theme.primaryDark}
                    />
                  ) : avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {displayName.slice(0, 2).toUpperCase()}
                    </ThemedText>
                  )}
                </View>
                {!isGroup && other && presence[other.userId] ? (
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: theme.primary, borderColor: theme.background },
                    ]}
                  />
                ) : null}
              </View>

              <View style={styles.info}>
                <View style={styles.infoTop}>
                  <View style={styles.nameRow}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                      {displayName}
                    </ThemedText>
                    {conv.type === 'BOARD' ? (
                      <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText
                          type="smallBold"
                          themeColor="textSecondary"
                          style={{ fontSize: 9, letterSpacing: 0.4 }}
                        >
                          BOARD
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {when ? (
                    <ThemedText
                      type="small"
                      themeColor={unread > 0 ? 'text' : 'textSecondary'}
                      style={{ fontSize: 11 }}
                    >
                      {when}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.previewRow}>
                  <ThemedText
                    type="small"
                    themeColor={unread > 0 ? 'text' : 'textSecondary'}
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {conv.lastMessage
                      ? conv.lastMessage.body
                      : isGroup
                        ? `${conv.members.length} members`
                        : 'Say hi 👋'}
                  </ThemedText>
                  {unread > 0 ? (
                    <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                      <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>
                        {unread > 99 ? '99+' : unread}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.four },
        ]}
        ListEmptyComponent={
          query.isLoading ? null : (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={30} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                No conversations yet. Open a board and start a chat, or message
                someone from their profile.
              </ThemedText>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    paddingHorizontal: Spacing.half,
  },
  sectionLabel: { letterSpacing: 0.8, fontSize: 11 },
  countPill: {
    minWidth: 20,
    borderRadius: 10,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    alignItems: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.half,
    borderRadius: Radius.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: { width: 52, height: 52 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 13,
    borderWidth: 2,
  },
  info: { flex: 1, gap: 3 },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  name: { flexShrink: 1 },
  tag: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    minWidth: 20,
    borderRadius: 10,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
