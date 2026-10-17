import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoardForm, type BoardFormValues } from '@/components/board-form';
import { Dissolve, Reveal } from '@/components/premium/motion';
import { ScreenHeader } from '@/components/premium/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UI_MESSAGES } from '@travel-board/shared';

export default function CreateBoardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Board creation runs through a React Query mutation so the boards list
  // cache can be invalidated in one place.
  const createMutation = useMutation({
    mutationFn: (values: BoardFormValues) => api.createBoard(values),
    onSuccess: async (board) => {
      await queryClient.invalidateQueries({ queryKey: ['boards', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['home'] });
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
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Sticky premium top bar */}
        <ScreenHeader title="New Board" divider />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header banner */}
          <Reveal>
            <View style={styles.banner}>
              <Dissolve style={StyleSheet.absoluteFill} color={theme.primary} speed={0.35} intensity={0.85} />
              <View style={[styles.bannerScrim, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
              <View style={styles.bannerBody}>
                <ThemedText style={styles.bannerTitle}>Curate your next trip</ThemedText>
                <ThemedText type="small" style={styles.bannerSub}>
                  Name it, set the dates, invite collaborators — the stops come next.
                </ThemedText>
              </View>
            </View>
          </Reveal>

          <Reveal delay={80}>
            <BoardForm
              submitLabel="Create board"
              onSubmit={submit}
              saving={submitting}
              error={error}
            />
          </Reveal>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: theme.borderSubtle },
              pressed && { opacity: 0.7 },
            ]}
          >
            <ThemedText type="smallBold" themeColor="textSecondary">
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
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },

  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },

  banner: {
    height: 132,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bannerBody: { padding: Spacing.three, gap: Spacing.half },
  bannerTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  bannerSub: { color: 'rgba(255,255,255,0.88)', lineHeight: 17 },

  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.three,
  },
});
