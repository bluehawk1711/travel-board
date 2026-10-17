import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardForm, type BoardFormValues } from '@/components/board-form';
import { ScreenHeader } from '@/components/premium/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { UI_MESSAGES } from '@travel-board/shared';

/** API dates are ISO-8601; the form edits plain YYYY-MM-DD. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export default function EditBoardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['board', id],
    queryFn: () => api.getBoard(id),
    enabled: !!id,
  });

  // Save/delete run through React Query mutations so cache invalidation lives
  // next to the write instead of in every handler.
  const updateMutation = useMutation({
    mutationFn: (values: BoardFormValues) => api.updateBoard(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', id] });
      await queryClient.invalidateQueries({ queryKey: ['boards', 'mine'] });
      router.back();
    },
    onError: (err: Error) => {
      setError(err instanceof ApiError ? err.message : UI_MESSAGES.BOARDS.SAVE_FAILED);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteBoard(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boards', 'mine'] });
      router.replace('/(tabs)');
    },
    onError: (err: Error) => {
      setError(err instanceof ApiError ? err.message : UI_MESSAGES.BOARDS.DELETE_FAILED);
    },
  });

  const board = query.data;
  const canEdit = board?.role === 'OWNER' || board?.role === 'EDITOR';
  const saving = updateMutation.isPending;
  const deleting = deleteMutation.isPending;

  const submit = useCallback(
    (values: BoardFormValues) => {
      setError(null);
      updateMutation.mutate(values);
    },
    [updateMutation],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete board', 'This permanently removes the board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }, [deleteMutation]);

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </SafeAreaView>
    );
  }

  if (query.isError || !board) {
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Couldn&apos;t load this board.
        </ThemedText>
        <Pressable
          onPress={() => query.refetch()}
          style={[styles.button, { backgroundColor: theme.text }]}
        >
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Retry
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!canEdit) {
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          You need editor access to change this board.
        </ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText type="small" themeColor="textSecondary">
            Go back
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Sticky premium top bar — back + cancel (previously scrolled away). */}
        <ScreenHeader
          title="Edit board"
          divider
          actions={
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BoardForm
            initialValues={{
              title: board.title,
              destination: board.destination ?? '',
              description: board.description ?? '',
              visibility: board.visibility,
              boardType: board.boardType,
              startDate: toDateInput(board.startDate),
              endDate: toDateInput(board.endDate),
              coverImageUrl: board.coverImageUrl ?? undefined,
            }}
            submitLabel="Save changes"
            onSubmit={submit}
            saving={saving}
            error={error}
          />

          {board.role === 'OWNER' ? (
            <Pressable
              onPress={confirmDelete}
              disabled={deleting}
              style={[
                styles.deleteButton,
                deleting && styles.disabled,
                { borderColor: theme.danger },
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={theme.danger} />
              ) : (
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.danger }}
                >
                  Delete board
                </ThemedText>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, gap: Spacing.three },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centerText: { textAlign: 'center' },
  button: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
});