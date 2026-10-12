import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardForm, type BoardFormValues } from '@/components/board-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UI_MESSAGES } from '@travel-board/shared';

export default function CreateBoardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Board creation runs through a React Query mutation so the boards list
  // cache can be invalidated in one place.
  const createMutation = useMutation({
    mutationFn: (values: BoardFormValues) => api.createBoard(values),
    onSuccess: async (board) => {
      await queryClient.invalidateQueries({ queryKey: ['boards', 'mine'] });
      router.replace(`/board/${board.id}`);
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError
          ? err.message
          : UI_MESSAGES.COMMON.GENERIC_ERROR,
      );
    },
  });

  const submit = useCallback(
    (values: BoardFormValues) => {
      setError(null);
      createMutation.mutate(values);
    },
    [createMutation],
  );

  const submitting = createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            New board
          </ThemedText>

          <BoardForm
            submitLabel="Create board"
            onSubmit={submit}
            saving={submitting}
            error={error}
          />

          <Pressable onPress={() => router.back()}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.cancel}
            >
              Cancel
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: { marginBottom: Spacing.one },
  cancel: { textAlign: 'center' },
});