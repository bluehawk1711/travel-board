import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardForm, type BoardFormValues } from '@/components/board-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: ['board', id],
    queryFn: () => api.getBoard(id),
    enabled: !!id,
  });

  const board = query.data;
  const canEdit = board?.role === 'OWNER' || board?.role === 'EDITOR';

  const submit = useCallback(
    async (values: BoardFormValues) => {
      setSaving(true);
      setError(null);
      try {
        await api.updateBoard(id, values);
        await queryClient.invalidateQueries({ queryKey: ['board', id] });
        await queryClient.invalidateQueries({ queryKey: ['boards', 'mine'] });
        router.back();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Could not save changes',
        );
      } finally {
        setSaving(false);
      }
    },
    [id, queryClient, router],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete board', 'This permanently removes the board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void api
            .deleteBoard(id)
            .then(async () => {
              await queryClient.invalidateQueries({
                queryKey: ['boards', 'mine'],
              });
              router.replace('/(tabs)');
            })
            .catch((err: unknown) => {
              setError(
                err instanceof ApiError ? err.message : 'Could not delete',
              );
              setDeleting(false);
            });
        },
      },
    ]);
  }, [id, queryClient, router]);

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
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Edit board</ThemedText>
            <Pressable onPress={() => router.back()}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

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
              style={[styles.deleteButton, deleting && styles.disabled]}
            >
              {deleting ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <ThemedText type="smallBold" style={styles.deleteText}>
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
  safe: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
    borderColor: '#dc2626',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  deleteText: { color: '#dc2626' },
  disabled: { opacity: 0.5 },
});