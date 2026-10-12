import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';

import { BoardComments } from '@/components/board-comments';
import { ItemFormModal } from '@/components/item-form-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import {
  applyBoardChange,
  type BoardChangeEvent,
  type BoardDetail,
  type BoardItem,
  type BoardPresenceEvent,
} from '@/lib/board-types';
import { getBoardSocket } from '@/lib/socket';

// ── Item card ──────────────────────────────────────────────────────────────

function ItemCard({
  item,
  boardId,
  sectionId,
  canEdit,
  onDeleted,
  onEdit,
}: {
  item: BoardItem;
  boardId: string;
  sectionId: string;
  canEdit: boolean;
  onDeleted: () => void;
  onEdit: (item: BoardItem) => void;
}) {
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    Alert.alert('Delete item', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteItem(boardId, sectionId, item.id);
            onDeleted();
          } catch {
            // silent
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.itemCard, { borderColor: theme.backgroundSelected }]}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.itemImage, { backgroundColor: theme.backgroundSelected }]}
          contentFit="cover"
          transition={150}
        />
      ) : null}
      <ThemedText type="smallBold">{item.title}</ThemedText>
      {item.description ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.itemDescription}
        >
          {item.description}
        </ThemedText>
      ) : null}
      {item.url ? (
        <ThemedText type="link" numberOfLines={1}>
          {item.url.replace(/^https?:\/\//, '').slice(0, 40)}
        </ThemedText>
      ) : null}
      {canEdit ? (
        <View style={styles.itemActions}>
          <Pressable onPress={() => onEdit(item)}>
            <ThemedText type="small" themeColor="textSecondary">
              Edit
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleDelete} disabled={deleting}>
            <ThemedText type="small" style={{ color: '#dc2626' }}>
              {deleting ? '...' : 'Delete'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

// ── Add section modal ──────────────────────────────────────────────────────

function AddSectionModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (title.trim()) {
      onAdd(title.trim());
      setTitle('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText type="subtitle" style={styles.modalTitle}>
            New section
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
            placeholder="Section title"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancelBtn}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              style={[styles.modalPrimaryBtn, { backgroundColor: theme.text }]}
            >
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Members modal ──────────────────────────────────────────────────────────

function MembersModal({
  visible,
  onClose,
  boardId,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  // Members load through React Query while the sheet is open.
  const membersQuery = useQuery({
    queryKey: ['board', boardId, 'members'],
    queryFn: () => api.getBoardMembers(boardId),
    enabled: visible,
  });
  const members = membersQuery.data?.members ?? [];
  const loading = membersQuery.isPending;

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: ['board', boardId, 'members'] });

  // Member writes are mutations so the list invalidates in one place.
  const addMutation = useMutation({
    mutationFn: (value: string) => api.addBoardMember(boardId, value),
    onSuccess: async () => {
      setEmail('');
      await invalidateMembers();
    },
  });
  const adding = addMutation.isPending;

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeBoardMember(boardId, userId),
    onSuccess: invalidateMembers,
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: 'EDITOR' | 'VIEWER' }) =>
      api.updateBoardMemberRole(boardId, vars.userId, vars.role),
    onSuccess: invalidateMembers,
  });

  const handleAdd = () => {
    if (!email.trim()) return;
    addMutation.mutate(email.trim().toLowerCase());
  };

  const handleRemove = (userId: string) => {
    removeMutation.mutate(userId);
  };

  const handleRoleChange = (userId: string, role: 'EDITOR' | 'VIEWER') => {
    roleMutation.mutate({ userId, role });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText type="subtitle" style={styles.modalTitle}>
            Members
          </ThemedText>

          {/* Add by email */}
          <View style={styles.addMemberRow}>
            <TextInput
              style={[
                styles.input,
                styles.addMemberInput,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                  color: theme.text,
                },
              ]}
              placeholder="Add by email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Pressable
              onPress={handleAdd}
              disabled={adding || !email.trim()}
              style={[styles.addMemberBtn, { backgroundColor: theme.text }]}
            >
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {adding ? '...' : 'Add'}
              </ThemedText>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.textSecondary} style={{ paddingVertical: Spacing.three }} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(m) => m.userId}
              renderItem={({ item: m }) => (
                <View style={[styles.memberRow, { borderColor: theme.backgroundSelected }]}>
                  <View style={styles.memberInfo}>
                    <ThemedText type="smallBold">{m.user.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {m.role}
                    </ThemedText>
                  </View>
                  <View style={styles.memberActions}>
                    {m.role !== 'OWNER' ? (
                      <>
                        <Pressable
                          onPress={() =>
                            handleRoleChange(
                              m.userId,
                              m.role === 'EDITOR' ? 'VIEWER' : 'EDITOR',
                            )
                          }
                        >
                          <ThemedText type="small" themeColor="textSecondary">
                            {m.role === 'EDITOR' ? 'Demote' : 'Promote'}
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => handleRemove(m.userId)}>
                          <ThemedText type="small" style={{ color: '#dc2626' }}>
                            Remove
                          </ThemedText>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}

          <Pressable onPress={onClose} style={[styles.modalPrimaryBtn, { backgroundColor: theme.text, marginTop: Spacing.three }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Done
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main board detail screen ───────────────────────────────────────────────

export default function BoardDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['board', id],
    queryFn: () => api.getBoard(id ?? ''),
    enabled: Boolean(id),
  });

  const [live, setLive] = useState<BoardDetail | null>(null);
  const [joined, setJoined] = useState(false);
  const [editors, setEditors] = useState<string[]>([]);
  const [deleted, setDeleted] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [itemModal, setItemModal] = useState<
    | { mode: 'create'; sectionId: string }
    | { mode: 'edit'; sectionId: string; item: BoardItem }
    | null
  >(null);
  const [showMembers, setShowMembers] = useState(false);

  const board = live ?? query.data;
  const boardRef = useRef<BoardDetail | null>(null);
  useEffect(() => {
    boardRef.current = board ?? null;
  }, [board]);

  const canEdit = board?.role === 'OWNER' || board?.role === 'EDITOR';

  /** Items with coordinates — the map view is only offered when there are any. */
  const mappedItems =
    board?.sections.flatMap((section) =>
      section.items.filter((item) => item.lat != null && item.lng != null),
    ) ?? [];

  // Like/save: the board query is the source of truth; an override holds the
  // optimistic flip until the mutation settles and the query refetches.
  const [likeOverride, setLikeOverride] = useState<{
    liked: boolean;
    count: number;
  } | null>(null);
  const [saveOverride, setSaveOverride] = useState<{
    saved: boolean;
    count: number;
  } | null>(null);

  const liked = likeOverride?.liked ?? board?.liked ?? false;
  const likeCount = likeOverride?.count ?? board?.likeCount ?? 0;
  const saved = saveOverride?.saved ?? board?.saved ?? false;
  const saveCount = saveOverride?.count ?? board?.saveCount ?? 0;

  const likeMutation = useMutation({
    mutationFn: (boardId: string) => api.toggleBoardLike(boardId),
    onSettled: async () => {
      setLikeOverride(null);
      await queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
  });
  const likePending = likeMutation.isPending;

  const saveMutation = useMutation({
    mutationFn: (boardId: string) => api.toggleBoardSave(boardId),
    onSettled: async () => {
      setSaveOverride(null);
      await queryClient.invalidateQueries({ queryKey: ['board', id] });
    },
  });
  const savePending = saveMutation.isPending;

  const handleLike = () => {
    if (!board || likePending) return;
    const next = !liked;
    setLikeOverride({
      liked: next,
      count: Math.max(0, likeCount + (next ? 1 : -1)),
    });
    likeMutation.mutate(board.id);
  };

  const handleSave = () => {
    if (!board || savePending) return;
    const next = !saved;
    setSaveOverride({
      saved: next,
      count: Math.max(0, saveCount + (next ? 1 : -1)),
    });
    saveMutation.mutate(board.id);
  };

  const handleDeleteBoard = () => {
    if (!board) return;
    Alert.alert('Delete board', `Delete "${board.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteBoard(board.id);
            router.back();
          } catch {
            // silent
          }
        },
      },
    ]);
  };

  const handleAddSection = async (title: string) => {
    if (!board) return;
    try {
      await api.createSection(board.id, title);
      query.refetch();
    } catch {
      // silent
    }
  };

  // Realtime
  const liveRef = useRef<{
    socket: Socket;
    handlers: { event: string; remove: () => void }[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBoardSocket()
      .then((socket) => {
        if (cancelled) return;
        socket.emit(
          'board:join',
          { boardId: id },
          (res: { ok: boolean }) => {
            if (!cancelled && res?.ok) setJoined(true);
          },
        );

        const onChange = (event: BoardChangeEvent) => {
          if (event.type === 'board:removed') {
            setDeleted(true);
            return;
          }
          if (event.type === 'board:updated') {
            void query.refetch();
            return;
          }
          setLive((prev) => {
            const base = prev ?? boardRef.current;
            return base ? applyBoardChange(base, event) : base;
          });
        };
        const onPresence = (payload: BoardPresenceEvent) => {
          setEditors(payload.activeUserIds);
        };

        socket.on('board:change', onChange);
        socket.on('board:presence', onPresence);
        liveRef.current = {
          socket,
          handlers: [
            { event: 'board:change', remove: () => socket.off('board:change', onChange) },
            { event: 'board:presence', remove: () => socket.off('board:presence', onPresence) },
          ],
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      const live2 = liveRef.current;
      liveRef.current = null;
      if (!live2) return;
      live2.socket.emit('board:leave', { boardId: id });
      for (const h of live2.handlers) h.remove();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      {query.isLoading && !board ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : notFound ? (
        <View style={styles.center}>
          <ThemedText type="subtitle">Board not found</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            It may have been deleted or you don&apos;t have access to it.
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={[styles.primaryButton, { backgroundColor: theme.text }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Go back
            </ThemedText>
          </Pressable>
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Couldn&apos;t load this board. Check that the API is running.
          </ThemedText>
          <Pressable
            onPress={() => query.refetch()}
            style={[styles.primaryButton, { backgroundColor: theme.text }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      ) : board ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="smallBold">←</ThemedText>
            </Pressable>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={styles.headerTitle}
            >
              {deleted ? 'Board' : board.title}
            </ThemedText>
            {canEdit ? (
              <Pressable onPress={handleDeleteBoard} hitSlop={8}>
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  Delete
                </ThemedText>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          {deleted ? (
            <View style={styles.deletedCard}>
              <ThemedText type="subtitle">This board was deleted</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                It was removed by a collaborator while you were viewing it.
              </ThemedText>
            </View>
          ) : (
            <>
              {/* Cover */}
              <View
                style={[
                  styles.cover,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                {board.coverImageUrl ? (
                  <Image
                    source={{ uri: board.coverImageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <ThemedText
                    type="smallBold"
                    themeColor="textSecondary"
                    numberOfLines={2}
                    style={styles.coverPlaceholder}
                  >
                    {board.destination ?? board.title}
                  </ThemedText>
                )}
                {board.boardType === 'ITINERARY' ? (
                  <View style={[styles.coverBadge, { backgroundColor: theme.text }]}>
                    <ThemedText
                      type="small"
                      style={[styles.coverBadgeText, { color: theme.background }]}
                    >
                      Itinerary
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {/* Meta + action bar */}
              <View style={styles.metaRow}>
                <Pressable
                  style={styles.ownerBlock}
                  onPress={() => router.push(`/user/${board.owner.id}`)}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                    {board.owner.avatarUrl ? (
                      <Image
                        source={{ uri: board.owner.avatarUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {board.owner.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.ownerText}>
                    <ThemedText type="smallBold">{board.owner.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {board.role
                        ? `You are a ${board.role.toLowerCase()}`
                        : 'Public board'}
                    </ThemedText>
                  </View>
                </Pressable>
              </View>

              {/* Like / Save / Members bar */}
              <View style={styles.actionBar}>
                <Pressable
                  onPress={handleLike}
                  disabled={likePending}
                  style={styles.actionBtn}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: liked ? '#dc2626' : theme.textSecondary }}
                  >
                    {liked ? '♥' : '♡'} {likeCount}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={savePending}
                  style={styles.actionBtn}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: saved ? '#3b82f6' : theme.textSecondary }}
                  >
                    {saved ? '★' : '☆'} {saveCount}
                  </ThemedText>
                </Pressable>
                {canEdit ? (
                  <Pressable
                    onPress={() => setShowMembers(true)}
                    style={styles.actionBtn}
                  >
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Members
                    </ThemedText>
                  </Pressable>
                ) : null}
                {canEdit ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/board/edit', params: { id: board.id } })}
                    style={styles.actionBtn}
                  >
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Edit
                    </ThemedText>
                  </Pressable>
                ) : null}
                {mappedItems.length > 0 ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/board/[id]/map',
                        params: { id: board.id },
                      })
                    }
                    style={styles.actionBtn}
                  >
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Map
                    </ThemedText>
                  </Pressable>
                ) : null}
                <View style={styles.stats}>
                  {[
                    { label: 'items', value: board.itemCount },
                    { label: 'saves', value: board.saveCount },
                  ].map((stat) => (
                    <View key={stat.label} style={styles.stat}>
                      <ThemedText type="smallBold">{stat.value}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {stat.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              {/* Live indicator */}
              <View style={styles.liveRow}>
                {joined ? (
                  <>
                    <View style={styles.liveDot} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {editors.length > 0
                        ? `Live · ${editors.length} ${editors.length === 1 ? 'person' : 'people'} viewing`
                        : 'Live'}
                    </ThemedText>
                  </>
                ) : null}
              </View>

              {board.description ? (
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.description}
                >
                  {board.description}
                </ThemedText>
              ) : null}

              {/* Sections */}
              {canEdit ? (
                <Pressable
                  onPress={() => setShowAddSection(true)}
                  style={[styles.addSectionBtn, { borderColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    + Add section
                  </ThemedText>
                </Pressable>
              ) : null}

              {board.sections.length === 0 ? (
                <View
                  style={[styles.emptyCard, { borderColor: theme.backgroundSelected }]}
                >
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    This board has no sections yet.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.sections}>
                  {board.sections.map((section) => (
                    <View key={section.id} style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>
                          {section.title}
                        </ThemedText>
                        {canEdit ? (
                          <Pressable
                            onPress={() =>
                              setItemModal({ mode: 'create', sectionId: section.id })
                            }
                          >
                            <ThemedText type="small" themeColor="textSecondary">
                              + Item
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>
                      {section.items.length === 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          No items in this section.
                        </ThemedText>
                      ) : (
                        <View style={styles.itemGrid}>
                          {section.items.map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              boardId={board.id}
                              sectionId={section.id}
                              canEdit={canEdit}
                              onDeleted={() => query.refetch()}
                              onEdit={(item) =>
                                setItemModal({
                                  mode: 'edit',
                                  sectionId: section.id,
                                  item,
                                })
                              }
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <BoardComments boardId={board.id} />
            </>
          )}
        </ScrollView>
      ) : null}

      <AddSectionModal
        visible={showAddSection}
        onClose={() => setShowAddSection(false)}
        onAdd={handleAddSection}
      />
      {board && itemModal ? (
        <ItemFormModal
          visible
          boardId={board.id}
          sectionId={itemModal.sectionId}
          item={itemModal.mode === 'edit' ? itemModal.item : null}
          showDate={board.boardType === 'ITINERARY'}
          onClose={() => setItemModal(null)}
          onSaved={() => query.refetch()}
        />
      ) : null}
      {id ? (
        <MembersModal
          visible={showMembers}
          onClose={() => setShowMembers(false)}
          boardId={id}
        />
      ) : null}
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
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backButton: {
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  headerSpacer: {
    width: Spacing.five,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.three,
  },
  coverPlaceholder: {
    textAlign: 'center',
  },
  coverBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  coverBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  ownerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  avatar: {
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Spacing.five,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerText: {
    flexShrink: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginLeft: 'auto',
  },
  stat: {
    alignItems: 'center',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    minHeight: Spacing.three,
  },
  liveDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#10b981',
  },
  description: {
    marginTop: Spacing.two,
    lineHeight: 20,
  },
  addSectionBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  sections: {
    marginTop: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginBottom: Spacing.one,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  itemCard: {
    width: '48%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.two,
  },
  itemDescription: {
    lineHeight: 18,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  itemDeleteBtn: {
    marginTop: Spacing.one,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  deletedCard: {
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.two,
  },
  emptyCard: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    padding: Spacing.five,
    alignItems: 'center',
  },
  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: Spacing.one,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  modalPrimaryBtn: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  // Members
  addMemberRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  addMemberInput: {
    flex: 1,
  },
  addMemberBtn: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: {
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
