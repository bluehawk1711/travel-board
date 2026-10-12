import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { SearchUser } from '@/lib/types';

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // User search runs through React Query, keyed by the submitted term.
  const searchQuery = useQuery({
    queryKey: ['users', 'search', submittedQuery],
    queryFn: () => api.searchUsers(submittedQuery),
    enabled: submittedQuery.length > 0,
  });

  const results = searchQuery.data?.users ?? [];
  const loading = searchQuery.isFetching;
  const searched = submittedQuery.length > 0;
  const queryError = searchQuery.error;
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError
        ? 'Search failed'
        : null;

  const doSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setSubmittedQuery(q);
  }, [query]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Search</ThemedText>
        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
            placeholder="Search users..."
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={doSearch}
          />
          <Pressable
            onPress={doSearch}
            disabled={loading || !query.trim()}
            style={[styles.searchBtn, { backgroundColor: theme.text }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {loading ? '...' : 'Go'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: '#dc2626', paddingHorizontal: Spacing.three }}>
          {error}
        </ThemedText>
      ) : null}

      <FlashList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/user/${item.id}`)}
            style={[styles.resultRow, { borderColor: theme.backgroundSelected }]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {item.name.slice(0, 2).toUpperCase()}
                </ThemedText>
              )}
            </View>
            <View style={styles.resultInfo}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.email}
              </ThemedText>
            </View>
          </Pressable>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
        ListEmptyComponent={
          searched && !loading ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No users found.
            </ThemedText>
          ) : !searched ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Search for people by name or email.
            </ThemedText>
          ) : null
        }
      />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  searchBtn: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { flex: 1, gap: 2 },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.four },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
