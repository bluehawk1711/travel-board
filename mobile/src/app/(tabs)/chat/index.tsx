import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

export default function ChatListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: api.getConversations,
  });

  const conversations = query.data ?? [];

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Messages</ThemedText>
      </View>

      <FlashList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const displayName = item.name ?? item.otherUser?.name ?? 'Unknown';
          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              style={[styles.row, { borderColor: theme.backgroundSelected }]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                {item.otherUser?.avatarUrl ? (
                  <Image
                    source={{ uri: item.otherUser.avatarUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {displayName.slice(0, 2).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={styles.info}>
                <View style={styles.infoTop}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                    {displayName}
                  </ThemedText>
                  {!!item.unreadCount && item.unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <ThemedText type="smallBold" style={styles.badgeText}>
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {item.lastMessage ? (
                  <ThemedText
                    type="small"
                    themeColor={item.unreadCount ? 'text' : 'textSecondary'}
                    numberOfLines={1}
                  >
                    {item.lastMessage.body}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
        ListEmptyComponent={
          query.isLoading ? null : (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No conversations yet.
            </ThemedText>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: { flexShrink: 1 },
  badge: {
    backgroundColor: '#2563eb',
    minWidth: 20,
    borderRadius: 10,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    alignItems: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 11, lineHeight: 14 },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.four },
});
