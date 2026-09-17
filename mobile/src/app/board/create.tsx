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

export default function CreateBoardScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (values: BoardFormValues) => {
      setSubmitting(true);
      setError(null);
      try {
        const { board } = await api.createBoard(values);
        router.replace(`/board/${board.id}`);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong — try again',
        );
        setSubmitting(false);
      }
    },
    [router],
  );

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