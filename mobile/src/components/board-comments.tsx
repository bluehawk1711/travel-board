import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { CommentItem } from '@/lib/types';

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: CommentItem;
  canDelete: boolean;
  onDelete: (commentId: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
        {comment.author.avatarUrl ? (
          <Image
            source={{ uri: comment.author.avatarUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <ThemedText type="smallBold" themeColor="textSecondary">
            {comment.author.name.slice(0, 2).toUpperCase()}
          </ThemedText>
        )}
      </View>
      <View style={styles.body}>
        <ThemedText type="smallBold">{comment.author.name}</ThemedText>
        <ThemedText type="small">{comment.body}</ThemedText>
      </View>
      {canDelete ? (
        <Pressable onPress={() => onDelete(comment.id)}>
          <ThemedText type="small" themeColor="textSecondary">
            Delete
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Board comments (features.md §4 social layer). */
export function BoardComments({ boardId }: { boardId: string }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['comments', boardId],
    queryFn: () => api.listComments(boardId),
  });

  const addMutation = useMutation({
    mutationFn: (body: string) => api.addComment(boardId, body),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['comments', boardId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not post comment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(boardId, commentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['comments', boardId] }),
  });

  const submit = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    addMutation.mutate(body);
  }, [draft, addMutation]);

  const comments = query.data?.items ?? [];

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">
        Comments
        {query.data?.total ? ` (${query.data.total})` : ''}
      </ThemedText>

      <View style={styles.composer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
              color: theme.text,
            },
          ]}
          placeholder="Add a comment…"
          placeholderTextColor={theme.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          onPress={submit}
          disabled={addMutation.isPending || !draft.trim()}
          style={[
            styles.postBtn,
            { backgroundColor: theme.text },
            (addMutation.isPending || !draft.trim()) && styles.disabled,
          ]}
        >
          {addMutation.isPending ? (
            <ActivityIndicator color={theme.background} size="small" />
          ) : (
            <ThemedText type="small" style={{ color: theme.background }}>
              Post
            </ThemedText>
          )}
        </Pressable>
      </View>

      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      {query.isLoading ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : comments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No comments yet.
        </ThemedText>
      ) : (
        comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            canDelete={comment.author.id === me?.id}
            onDelete={(commentId) => deleteMutation.mutate(commentId)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.three },
  composer: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    maxHeight: 100,
  },
  postBtn: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    minWidth: 56,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  error: { color: '#dc2626' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});