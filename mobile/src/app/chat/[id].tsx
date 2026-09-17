import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { getBoardSocket } from '@/lib/socket';

interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}

interface Member {
  userId: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

export default function ChatViewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const myIdRef = useRef<string | null>(null);
  const typingSentAtRef = useRef(0);

  // Get current user — cache via query client to avoid redundant calls.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  });
  useEffect(() => {
    if (meQuery.data) {
      myIdRef.current = meQuery.data.user.id;
      setMyId(meQuery.data.user.id);
    }
  }, [meQuery.data]);

  // Fetch conversation details + messages
  const convQuery = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.getConversation(id ?? ''),
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api.getMessages(id ?? ''),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data.items);
      // Opened the screen — mark everything currently loaded as read.
      const last = messagesQuery.data.items.at(-1);
      if (id && last) {
        getBoardSocket()
          .then((socket) => {
            socket.emit('message:read', {
              conversationId: id,
              lastMessageId: Number(last.id),
            });
          })
          .catch(() => {});
      }
    }
  }, [messagesQuery.data, id]);

  // Socket for realtime — cleanup runs outside .then() via ref.
  const socketRef = useRef<Socket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBoardSocket()
      .then((socket) => {
        if (cancelled) return;
        socket.emit('conversation:join', { conversationId: id });
        socketRef.current = socket;

        const onMessage = (msg: Message) => {
          if (msg.senderId !== myIdRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
            // Screen is open — mark newly received messages read immediately.
            socket.emit('message:read', {
              conversationId: id,
              lastMessageId: Number(msg.id),
            });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }
        };
        socket.on('message:new', onMessage);

        const onTyping = (payload: {
          conversationId: string;
          userId: string;
        }) => {
          if (
            payload.conversationId !== id ||
            payload.userId === myIdRef.current
          ) {
            return;
          }
          setTypingUserIds((prev) =>
            prev.includes(payload.userId) ? prev : [...prev, payload.userId],
          );
        };
        socket.on('user:typing', onTyping);

        cleanupRef.current = () => {
          socket.off('message:new', onMessage);
          socket.off('user:typing', onTyping);
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Typing indicators are momentary — clear them after a few seconds.
  useEffect(() => {
    if (typingUserIds.length === 0) return;
    const t = setTimeout(() => setTypingUserIds([]), 4_000);
    return () => clearTimeout(t);
  }, [typingUserIds]);

  const handleSend = async () => {
    if (!input.trim() || !id) return;
    const body = input.trim();
    setInput('');
    try {
      const msg = await api.sendMessage(id, body);
      setMessages((prev) => [...prev, msg]);
    } catch {
      // silent
    }
  };

  const members = convQuery.data?.members ?? [];
  const getMemberName = (userId: string) => {
    const m = members.find((m: Member) => m.userId === userId);
    return m?.user.name ?? 'Unknown';
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold">←</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
          {convQuery.data?.name ?? 'Chat'}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>
      {typingUserIds.length > 0 ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.typingRow}
        >
          {typingUserIds.length === 1
            ? `${getMemberName(typingUserIds[0])} is typing…`
            : 'Several people are typing…'}
        </ThemedText>
      ) : null}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.senderId === myId;
          return (
            <View
              style={[
                styles.bubble,
                isMine
                  ? [styles.bubbleMine, { backgroundColor: theme.text }]
                  : [styles.bubbleTheirs, { backgroundColor: theme.backgroundElement }],
              ]}
            >
              {!isMine ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.senderName}>
                  {getMemberName(item.senderId)}
                </ThemedText>
              ) : null}
              <ThemedText
                type="small"
                style={{ color: isMine ? theme.background : theme.text }}
              >
                {item.body}
              </ThemedText>
            </View>
          );
        }}
        ListEmptyComponent={
          messagesQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No messages yet.
            </ThemedText>
          )
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputBar, { borderTopColor: theme.backgroundSelected }]}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              // Throttled typing indicator — at most one emit per 2.5s.
              const now = Date.now();
              if (
                text.trim() &&
                id &&
                now - typingSentAtRef.current > 2_500 &&
                socketRef.current?.connected
              ) {
                typingSentAtRef.current = now;
                socketRef.current.emit('message:typing', {
                  conversationId: id,
                });
              }
            }}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim()}
            style={[styles.sendBtn, { backgroundColor: theme.text }, !input.trim() && { opacity: 0.5 }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Send
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1 },
  headerSpacer: { width: Spacing.five },
  typingRow: { paddingHorizontal: Spacing.three, marginBottom: Spacing.one },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: Spacing.half,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Spacing.half,
  },
  senderName: { marginBottom: Spacing.half, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  sendBtn: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.four },
});
