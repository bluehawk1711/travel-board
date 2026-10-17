import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';
import { UI_MESSAGES } from '@travel-board/shared';

import { Avatar } from '@/components/avatar';
import { BoardComments } from '@/components/board-comments';
import { ItemFormModal } from '@/components/item-form-modal';
import { Dissolve, Reveal } from '@/components/premium/motion';
import { FloatingActionMenu, type FloatingAction } from '@/components/premium/floating-menu';
import { GlassButton } from '@/components/premium/glass';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/pill-button';
import { MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import {
  applyBoardChange,
  type BoardChangeEvent,
  type BoardDetail,
  type BoardItem,
  type BoardItemType,
  type BoardPresenceEvent,
} from '@/lib/board-types';
import { getBoardSocket } from '@/lib/socket';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_META: Record<BoardItemType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  PLACE: { icon: 'location-outline', label: 'Place' },
  RESTAURANT: { icon: 'restaurant-outline', label: 'Dining' },
  HOTEL: { icon: 'bed-outline', label: 'Stay' },
  ACTIVITY: { icon: 'sparkles-outline', label: 'Activity' },
  NOTE: { icon: 'document-text-outline', label: 'Note' },
  LINK: { icon: 'link-outline', label: 'Link' },
  IMAGE: { icon: 'image-outline', label: 'Photo' },
};

/** Per-type badge tints — every stop type reads at a glance (image-3 style). */
function typeTone(
  type: BoardItemType,
  theme: ReturnType<typeof useTheme>,
): { bg: string; fg: string } {
  switch (type) {
    case 'PLACE':
      return { bg: `${theme.info}1F`, fg: theme.info };
    case 'RESTAURANT':
      return { bg: `${theme.golden}1F`, fg: theme.golden };
    case 'HOTEL':
      return { bg: theme.primaryContainer, fg: theme.primaryDark };
    case 'ACTIVITY':
      return { bg: theme.tertiaryLight, fg: theme.tertiary };
    default:
      return { bg: theme.backgroundElement, fg: theme.textSecondary };
  }
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function dayLabel(index: number): string {
  return `DAY ${String(index + 1).padStart(2, '0')}`;
}

/** "8 Days · Oct 5–12" from the board's start/end dates. */
function formatRange(startISO: string | null, endISO: string | null): string | null {
  if (!startISO || !endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days <= 0) return null;
  const sameMonth = start.getMonth() === end.getMonth();
  const range = sameMonth
    ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
    : `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${days} Days · ${range}`;
}

function sectionDate(startDateISO: string | null, index: number): string | null {
  if (!startDateISO) return null;
  const start = new Date(startDateISO);
  if (Number.isNaN(start.getTime())) return null;
  const d = new Date(start.getTime() + index * 86_400_000);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function mapsUrl(lat: number, lng: number): string {
  return Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  }) as string;
}

// ── Timeline item ─────────────────────────────────────────────────────────

function TimelineItem({
  item,
  boardId,
  sectionId,
  canEdit,
  isFirst,
  isLast,
  onDeleted,
  onEdit,
  onMove,
}: {
  item: BoardItem;
  boardId: string;
  sectionId: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDeleted: () => void;
  onEdit: (item: BoardItem) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const meta = TYPE_META[item.type] ?? TYPE_META.PLACE;
  const tone = typeTone(item.type, theme);
  const time = formatTime(item.date);

  const handleDelete = () => {
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

  const handleMove = (direction: -1 | 1) => {
    if (moving) return;
    setMoving(true);
    onMove(direction);
    setTimeout(() => setMoving(false), 400);
  };

  return (
    <View style={styles.timelineRow}>
      {/* Time rail */}
      <View style={styles.timeCol}>
        <View style={[styles.dot, { backgroundColor: theme.primary, borderColor: theme.background }]} />
        {!isLast ? <View style={[styles.line, { backgroundColor: theme.borderSubtle }]} /> : null}
      </View>

      {/* Card */}
      <Reveal style={styles.itemCardWrap} delay={60}>
        <View style={[styles.itemCard, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }]}>
          {/* Badge row: stop type + scheduled time */}
          <View style={styles.itemTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: tone.bg }]}>
              <Ionicons name={meta.icon} size={11} color={tone.fg} />
              <ThemedText style={[styles.typeBadgeText, { color: tone.fg }]}>
                {meta.label}
              </ThemedText>
            </View>
            {time ? (
              <View style={[styles.timePill, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="time-outline" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.typeBadgeText, { color: theme.textSecondary }]}>
                  {time}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Body: optional thumbnail + title/description */}
          <View style={styles.itemBody}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.itemThumb, { backgroundColor: theme.backgroundElement }]}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <View style={styles.itemBodyText}>
              <ThemedText type="smallBold" style={styles.itemTitle}>
                {item.title}
              </ThemedText>
              {item.description ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.itemDescription}>
                  {item.description}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {(item.url || (item.lat != null && item.lng != null)) && (
            <View style={styles.chipRow}>
              {item.url ? (
                <Pressable
                  onPress={() => void Linking.openURL(item.url!)}
                  style={[styles.chip, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons name="open-outline" size={13} color={theme.text} />
                  <ThemedText type="small" numberOfLines={1} style={styles.chipText}>
                    Open link
                  </ThemedText>
                </Pressable>
              ) : null}
              {item.lat != null && item.lng != null ? (
                <Pressable
                  onPress={() => void Linking.openURL(mapsUrl(item.lat!, item.lng!))}
                  style={[styles.chip, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons name="navigate-outline" size={13} color={theme.info} />
                  <ThemedText type="small" style={[styles.chipText, { color: theme.info }]}>
                    Map
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          )}

          {canEdit ? (
            <View style={[styles.itemActions, { borderTopColor: theme.borderSubtle }]}>
              <Pressable onPress={() => onEdit(item)} hitSlop={6} style={[styles.actionTile, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="create-outline" size={14} color={theme.textSecondary} />
              </Pressable>
              <Pressable onPress={() => handleMove(-1)} disabled={isFirst || moving} hitSlop={6} style={[styles.actionTile, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons
                  name="chevron-up"
                  size={14}
                  color={theme.textSecondary}
                  style={isFirst ? { opacity: 0.35 } : undefined}
                />
              </Pressable>
              <Pressable onPress={() => handleMove(1)} disabled={isLast || moving} hitSlop={6} style={[styles.actionTile, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={theme.textSecondary}
                  style={isLast ? { opacity: 0.35 } : undefined}
                />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={handleDelete} disabled={deleting} hitSlop={6} style={[styles.actionTile, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="trash-outline" size={14} color={deleting ? theme.textSecondary : theme.danger} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Reveal>
    </View>
  );
}

// ── Add / rename section modal ────────────────────────────────────────────

function AddSectionModal({
  visible,
  onClose,
  onAdd,
  initialTitle = '',
  heading = 'New day',
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
  initialTitle?: string;
  heading?: string;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(initialTitle);

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
        <Pressable style={[styles.modalCard, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            {heading}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle, color: theme.text },
            ]}
            placeholder="Section title"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancelBtn}>
              <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={handleAdd} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Add</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Members modal ─────────────────────────────────────────────────────────

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

  const membersQuery = useQuery({
    queryKey: ['board', boardId, 'members'],
    queryFn: () => api.getBoardMembers(boardId),
    enabled: visible,
  });
  const members = membersQuery.data ?? [];
  const loading = membersQuery.isPending;

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: ['board', boardId, 'members'] });

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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalCard, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            Members
          </ThemedText>

          <View style={styles.addMemberRow}>
            <TextInput
              style={[
                styles.input,
                styles.addMemberInput,
                { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle, color: theme.text },
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
              style={[styles.addMemberBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {adding ? '…' : 'Add'}
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
                <View style={[styles.memberRow, { borderColor: theme.borderSubtle }]}>
                  <Avatar uri={m.user.avatarUrl} name={m.user.name} size={36} />
                  <View style={styles.memberInfo}>
                    <ThemedText type="smallBold">{m.user.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{m.role}</ThemedText>
                  </View>
                  <View style={styles.memberActions}>
                    {m.role !== 'OWNER' ? (
                      <>
                        <Pressable onPress={() => roleMutation.mutate({ userId: m.userId, role: m.role === 'EDITOR' ? 'VIEWER' : 'EDITOR' })}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {m.role === 'EDITOR' ? 'Demote' : 'Promote'}
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => removeMutation.mutate(m.userId)}>
                          <ThemedText type="small" style={{ color: theme.danger }}>Remove</ThemedText>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}

          <Pressable onPress={onClose} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary, marginTop: Spacing.three }]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Done</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Segmented tab bar ─────────────────────────────────────────────────────

type TabKey = 'itinerary' | 'places' | 'map';

function SegmentedTabs({
  value,
  onChange,
  counts,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
  counts: { places: number };
}) {
  const theme = useTheme();
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'itinerary', label: 'Itinerary' },
    { key: 'places', label: `Places (${counts.places})` },
    { key: 'map', label: 'Map' },
  ];
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.segmentItem, active && { backgroundColor: theme.surfaceCard, ...Shadows.card }]}
          >
            <ThemedText
              type="smallBold"
              themeColor={active ? 'text' : 'textSecondary'}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  const [tab, setTab] = useState<TabKey>('itinerary');
  // Day selector (image-3 style): null = all days, otherwise a single day.
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [itemModal, setItemModal] = useState<
    { mode: 'create'; sectionId: string } | { mode: 'edit'; sectionId: string; item: BoardItem } | null
  >(null);
  const [showMembers, setShowMembers] = useState(false);
  const [chatOpening, setChatOpening] = useState(false);
  const [renameSection, setRenameSection] = useState<{ id: string; title: string } | null>(null);

  const board = live ?? query.data;
  const boardRef = useRef<BoardDetail | null>(null);
  useEffect(() => {
    boardRef.current = board ?? null;
  }, [board]);

  const canEdit = board?.role === 'OWNER' || board?.role === 'EDITOR';

  // Members feed both the hero avatar stack and the members modal (shared key).
  const membersQuery = useQuery({
    queryKey: ['board', id, 'members'],
    queryFn: () => api.getBoardMembers(id ?? ''),
    enabled: Boolean(id),
  });
  const members = membersQuery.data ?? [];

  const mappedItems =
    board?.sections.flatMap((section) => section.items.filter((i) => i.lat != null && i.lng != null)) ?? [];
  const allItems = board?.sections.flatMap((s) => s.items) ?? [];

  const [likeOverride, setLikeOverride] = useState<{ liked: boolean; count: number } | null>(null);
  const [saveOverride, setSaveOverride] = useState<{ saved: boolean; count: number } | null>(null);

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

  const copyMutation = useMutation({
    mutationFn: (boardId: string) => api.copyBoard(boardId),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      router.push(`/board/${copy.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/(auth)/sign-in');
        return;
      }
      Alert.alert(
        UI_MESSAGES.BOARDS.COPY_FAILED,
        err instanceof ApiError ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR,
      );
    },
  });
  const copyPending = copyMutation.isPending;

  const handleCopy = () => {
    if (!board || copyPending) return;
    copyMutation.mutate(board.id);
  };

  const handleLike = () => {
    if (!board || likePending) return;
    const next = !liked;
    setLikeOverride({ liked: next, count: Math.max(0, likeCount + (next ? 1 : -1)) });
    likeMutation.mutate(board.id);
  };

  const handleSave = () => {
    if (!board || savePending) return;
    const next = !saved;
    setSaveOverride({ saved: next, count: Math.max(0, saveCount + (next ? 1 : -1)) });
    saveMutation.mutate(board.id);
  };

  const handleShare = async () => {
    if (!board) return;
    try {
      await Share.share({ message: `${board.title} — Travel Board` });
    } catch {
      // silent
    }
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
      setDayFilter(null);
    } catch {
      // silent
    }
  };

  const handleOpenChat = async () => {
    if (!board || chatOpening) return;
    setChatOpening(true);
    try {
      const conv = await api.getBoardConversation(board.id);
      router.push(`/chat/${conv.id}`);
    } catch {
      // silent
    } finally {
      setChatOpening(false);
    }
  };

  const handleRenameSection = async (title: string) => {
    if (!board || !renameSection || !title.trim()) return;
    try {
      await api.updateSection(board.id, renameSection.id, { title: title.trim() });
      setRenameSection(null);
      query.refetch();
    } catch {
      // silent
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!board) return;
    Alert.alert('Delete day', 'Delete this day and all of its stops?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSection(board.id, sectionId);
            query.refetch();
            setDayFilter(null);
          } catch {
            // silent
          }
        },
      },
    ]);
  };

  const handleMoveSection = async (sectionId: string, direction: -1 | 1) => {
    if (!board) return;
    const ids = board.sections.map((s) => s.id);
    const index = ids.indexOf(sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await api.reorderSections(board.id, ids);
      query.refetch();
      setDayFilter(null);
    } catch {
      // silent
    }
  };

  const handleMoveItem = async (sectionId: string, itemId: string, direction: -1 | 1) => {
    if (!board) return;
    const section = board.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const ids = section.items.map((i) => i.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await api.reorderItems(board.id, sectionId, ids);
      query.refetch();
    } catch {
      // silent
    }
  };

  /** Quick-add a stop: into the given (or first) section, creating a day if none. */
  const handleQuickAddItem = () => {
    if (!board) return;
    if (board.sections.length === 0) {
      setShowAddSection(true);
      return;
    }
    setItemModal({ mode: 'create', sectionId: board.sections[0]!.id });
  };

  // Realtime
  const liveRef = useRef<{ socket: Socket; handlers: { event: string; remove: () => void }[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBoardSocket()
      .then((socket) => {
        if (cancelled) return;
        socket.emit('board:join', { boardId: id }, (res: { ok: boolean }) => {
          if (!cancelled && res?.ok) setJoined(true);
        });

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
  const dateRange = board ? formatRange(board.startDate, board.endDate) : null;
  // Ignore a stale filter (e.g. days were deleted while one was selected).
  const safeDayFilter =
    board && dayFilter !== null && dayFilter >= board.sections.length ? null : dayFilter;

  // Floating menu actions by permission.
  const floatActions: FloatingAction[] = !board
    ? []
    : canEdit
      ? [
          { key: 'add', icon: 'add' as const, label: 'Add stop', onPress: handleQuickAddItem },
          { key: 'day', icon: 'sunny-outline' as const, label: 'Add day', onPress: () => setShowAddSection(true) },
          { key: 'members', icon: 'people-outline' as const, label: 'Members', onPress: () => setShowMembers(true) },
          { key: 'chat', icon: 'chatbubble-outline' as const, label: 'Board chat', onPress: () => void handleOpenChat() },
          { key: 'edit', icon: 'create-outline' as const, label: 'Edit board', onPress: () => router.push({ pathname: '/board/edit', params: { id: board.id } }) },
          { key: 'delete', icon: 'trash-outline' as const, label: 'Delete board', onPress: handleDeleteBoard, danger: true },
        ]
      : board.role
        ? [
            { key: 'chat', icon: 'chatbubble-outline' as const, label: 'Board chat', onPress: () => void handleOpenChat() },
            { key: 'members', icon: 'people-outline' as const, label: 'Members', onPress: () => setShowMembers(true) },
            { key: 'save', icon: saved ? 'bookmark' : 'bookmark-outline' as const, label: saved ? 'Unsave' : 'Save', onPress: handleSave },
          ]
        : [
            { key: 'copy', icon: 'copy-outline' as const, label: copyPending ? '…' : 'Copy board', onPress: handleCopy },
            { key: 'save', icon: saved ? 'bookmark' : 'bookmark-outline' as const, label: saved ? 'Unsave' : 'Save', onPress: handleSave },
            { key: 'share', icon: 'share-outline' as const, label: 'Share', onPress: () => void handleShare() },
          ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
            <Pressable onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Go back</ThemedText>
            </Pressable>
          </View>
        ) : query.isError ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Couldn&apos;t load this board. Check that the API is running.
            </ThemedText>
            <Pressable onPress={() => query.refetch()} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : board ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* ── Hero ── */}
            <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
              {board.coverImageUrl ? (
                <Image source={{ uri: board.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <Dissolve style={StyleSheet.absoluteFill} color={theme.primary} />
              )}
              <View style={[styles.heroScrim, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />
              <View style={[styles.heroScrimLower, { backgroundColor: 'rgba(0,0,0,0.34)' }]} />
              <View style={[styles.heroScrimBase, { backgroundColor: 'rgba(0,0,0,0.52)' }]} />

              {/* Top controls */}
              <View style={styles.heroControls}>
                <GlassButton onPress={() => router.back()} accessibilityLabel="Go back">
                  <Ionicons name={Platform.OS === 'android' ? 'arrow-forward' : 'chevron-back'} size={22} color={theme.text} />
                </GlassButton>
                <View style={styles.heroRightControls}>
                  <Pressable onPress={() => (canEdit ? setShowMembers(true) : void handleShare())}>
                    <View style={styles.avatarStack}>
                      <Avatar uri={board.owner.avatarUrl} name={board.owner.name} size={30} />
                      {members.slice(0, 3).map((m, i) => (
                        <View key={m.userId} style={[styles.stackOverlap, { marginLeft: -10, zIndex: 10 - i }]}>
                          <Avatar uri={m.user.avatarUrl} name={m.user.name} size={30} online />
                        </View>
                      ))}
                    </View>
                  </Pressable>
                  <GlassButton onPress={() => void handleShare()} accessibilityLabel="Share board">
                    <Ionicons name="share-outline" size={20} color={theme.text} />
                  </GlassButton>
                </View>
              </View>

              {/* Title block */}
              <View style={styles.heroBody}>
                <View style={styles.badgeRow}>
                  {joined ? (
                    <View style={[styles.pill, { backgroundColor: 'rgba(14,116,83,0.9)' }]}>
                      <View style={styles.liveDot} />
                      <ThemedText type="smallBold" style={styles.pillTextOn}>
                        {editors.length > 0 ? `Live · ${editors.length + 1} viewing` : 'Live'}
                      </ThemedText>
                    </View>
                  ) : null}
                  {dateRange ? (
                    <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                      <Ionicons name="calendar-outline" size={12} color="#fff" />
                      <ThemedText type="smallBold" style={styles.pillTextOn}>{dateRange}</ThemedText>
                    </View>
                  ) : null}
                  {board.boardType === 'ITINERARY' ? (
                    <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                      <Ionicons name="map-outline" size={12} color="#fff" />
                      <ThemedText type="smallBold" style={styles.pillTextOn}>Itinerary</ThemedText>
                    </View>
                  ) : null}
                </View>

                <ThemedText style={styles.heroTitle}>{deleted ? 'Board' : board.title}</ThemedText>

                <Pressable style={styles.breadcrumb} onPress={() => router.push(`/user/${board.owner.id}`)}>
                  {board.destination ? (
                    <>
                      <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.9)" />
                      <ThemedText type="small" style={styles.breadcrumbText}>{board.destination}</ThemedText>
                      <ThemedText type="small" style={styles.breadcrumbSep}>·</ThemedText>
                    </>
                  ) : null}
                  <ThemedText type="small" style={styles.breadcrumbText}>
                    Curated by {board.owner.name.split(' ')[0]}
                  </ThemedText>
                </Pressable>
              </View>
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
                {/* ── Stats + like/save row ── */}
                <View style={[styles.statStrip, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }, Shadows.card]}>
                  <Pressable onPress={handleLike} disabled={likePending} style={styles.statBtn}>
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? theme.danger : theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor={likeCount ? 'text' : 'textSecondary'}>{likeCount}</ThemedText>
                  </Pressable>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderSubtle }]} />
                  <Pressable onPress={handleSave} disabled={savePending} style={styles.statBtn}>
                    <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? theme.golden : theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor={saveCount ? 'text' : 'textSecondary'}>{saveCount}</ThemedText>
                  </Pressable>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderSubtle }]} />
                  <View style={styles.statBtn}>
                    <Ionicons name="cube-outline" size={15} color={theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor="textSecondary">{board.itemCount}</ThemedText>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.borderSubtle }]} />
                  <View style={styles.statBtn}>
                    <Ionicons name="people-outline" size={15} color={theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor="textSecondary">{board.memberCount}</ThemedText>
                  </View>
                </View>

                {board.description ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
                    {board.description}
                  </ThemedText>
                ) : null}

                {/* ── Tabs ── */}
                <SegmentedTabs value={tab} onChange={setTab} counts={{ places: allItems.length }} />

                {/* ── Itinerary (day-by-day timeline) ── */}
                {tab === 'itinerary' ? (
                  board.sections.length === 0 ? (
                    <View style={[styles.emptyCard, { borderColor: theme.borderSubtle }]}>
                      <Ionicons name="calendar-outline" size={28} color={theme.textSecondary} />
                      <ThemedText themeColor="textSecondary" style={styles.centerText}>
                        No days yet. {canEdit ? 'Tap “Add day” to start planning.' : ''}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.sections}>
                      {/* Day selector chips */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dayChipRow}
                      >
                        <Chip
                          label="All Days"
                          active={safeDayFilter === null}
                          onPress={() => setDayFilter(null)}
                        />
                        {board.sections.map((section, i) => (
                          <Chip
                            key={section.id}
                            label={`Day ${i + 1}`}
                            active={safeDayFilter === i}
                            onPress={() => setDayFilter(i)}
                          />
                        ))}
                      </ScrollView>
                      {board.sections.map((section, sIndex) => {
                        if (safeDayFilter !== null && sIndex !== safeDayFilter) return null;
                        const date = sectionDate(board.startDate, sIndex);
                        return (
                          <Reveal key={section.id} delay={sIndex * 60} style={styles.dayBlock}>
                            {/* Day header */}
                            <View style={styles.dayHeader}>
                              <View style={[styles.dayTag, { backgroundColor: theme.primaryContainer }]}>
                                <Ionicons name="sunny-outline" size={12} color={theme.primaryDark} />
                                <ThemedText type="smallBold" style={{ color: theme.primaryDark }}>
                                  {dayLabel(sIndex)}
                                </ThemedText>
                              </View>
                              <View style={styles.dayHeaderText}>
                                <ThemedText type="subtitle" style={styles.dayTitle}>{section.title}</ThemedText>
                                {date ? (
                                  <ThemedText type="small" themeColor="textSecondary">{date}</ThemedText>
                                ) : null}
                              </View>
                            </View>

                            {/* Section controls */}
                            {canEdit ? (
                              <View style={styles.sectionControls}>
                                <Pressable onPress={() => setItemModal({ mode: 'create', sectionId: section.id })} style={[styles.sectionCtl, { backgroundColor: theme.primary }]}>
                                  <Ionicons name="add" size={14} color={theme.onPrimary} />
                                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Add stop</ThemedText>
                                </Pressable>
                                <Pressable onPress={() => setRenameSection({ id: section.id, title: section.title })} hitSlop={6} style={[styles.sectionIcon, { backgroundColor: theme.backgroundElement }]}>
                                  <Ionicons name="create-outline" size={14} color={theme.textSecondary} />
                                </Pressable>
                                <Pressable onPress={() => handleMoveSection(section.id, -1)} disabled={sIndex === 0} hitSlop={6} style={[styles.sectionIcon, { backgroundColor: theme.backgroundElement }]}>
                                  <Ionicons name="chevron-up" size={14} color={theme.textSecondary} style={sIndex === 0 ? { opacity: 0.35 } : undefined} />
                                </Pressable>
                                <Pressable onPress={() => handleMoveSection(section.id, 1)} disabled={sIndex === board.sections.length - 1} hitSlop={6} style={[styles.sectionIcon, { backgroundColor: theme.backgroundElement }]}>
                                  <Ionicons name="chevron-down" size={14} color={theme.textSecondary} style={sIndex === board.sections.length - 1 ? { opacity: 0.35 } : undefined} />
                                </Pressable>
                                <View style={{ flex: 1 }} />
                                <Pressable onPress={() => handleDeleteSection(section.id)} hitSlop={6} style={[styles.sectionIcon, { backgroundColor: theme.backgroundElement }]}>
                                  <Ionicons name="trash-outline" size={14} color={theme.danger} />
                                </Pressable>
                              </View>
                            ) : null}

                            {/* Timeline items */}
                            {section.items.length === 0 ? (
                              <ThemedText type="small" themeColor="textSecondary" style={styles.noStops}>
                                No stops for this day.
                              </ThemedText>
                            ) : (
                              <View style={styles.timeline}>
                                {section.items.map((item, iIndex) => (
                                  <TimelineItem
                                    key={item.id}
                                    item={item}
                                    boardId={board.id}
                                    sectionId={section.id}
                                    canEdit={!!canEdit}
                                    isFirst={iIndex === 0}
                                    isLast={iIndex === section.items.length - 1}
                                    onDeleted={() => query.refetch()}
                                    onEdit={(it) => setItemModal({ mode: 'edit', sectionId: section.id, item: it })}
                                    onMove={(dir) => handleMoveItem(section.id, item.id, dir)}
                                  />
                                ))}
                              </View>
                            )}
                          </Reveal>
                        );
                      })}

                      {canEdit ? (
                        <Pressable onPress={() => setShowAddSection(true)} style={[styles.addDayBtn, { borderColor: theme.primary }]}>
                          <Ionicons name="add" size={18} color={theme.primary} />
                          <ThemedText type="smallBold" style={{ color: theme.primary }}>Add another day</ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  )
                ) : null}

                {/* ── Places grid ── */}
                {tab === 'places' ? (
                  allItems.length === 0 ? (
                    <View style={[styles.emptyCard, { borderColor: theme.borderSubtle }]}>
                      <Ionicons name="location-outline" size={28} color={theme.textSecondary} />
                      <ThemedText themeColor="textSecondary" style={styles.centerText}>No places yet.</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.placesGrid}>
                      {allItems.map((item, i) => {
                        const meta = TYPE_META[item.type] ?? TYPE_META.PLACE;
                        return (
                          <Reveal key={item.id} delay={i * 40} style={styles.placeCell}>
                            <Pressable
                              onPress={() =>
                                item.lat != null && item.lng != null
                                  ? void Linking.openURL(mapsUrl(item.lat, item.lng))
                                  : item.url
                                    ? void Linking.openURL(item.url)
                                    : undefined
                              }
                              style={[styles.placeCard, { backgroundColor: theme.surfaceCard, borderColor: theme.borderSubtle }]}
                            >
                              {item.imageUrl ? (
                                <Image source={{ uri: item.imageUrl }} style={styles.placeImage} contentFit="cover" transition={150} />
                              ) : (
                                <View style={[styles.placeImage, styles.placeImageEmpty, { backgroundColor: theme.backgroundElement }]}>
                                  <Ionicons name={meta.icon} size={22} color={theme.textSecondary} />
                                </View>
                              )}
                              <View style={styles.placeBody}>
                                <ThemedText type="smallBold" numberOfLines={1}>{item.title}</ThemedText>
                                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                                  {meta.label}
                                </ThemedText>
                              </View>
                            </Pressable>
                          </Reveal>
                        );
                      })}
                    </View>
                  )
                ) : null}

                {/* ── Map ── */}
                {tab === 'map' ? (
                  <Reveal style={styles.mapPanel}>
                    <Dissolve style={styles.mapDissolve} color={theme.info} speed={0.3}>
                      <View style={styles.mapInner}>
                        <Ionicons name="map" size={34} color={theme.onImage} />
                        <ThemedText type="smallBold" style={{ color: theme.onImage, marginTop: Spacing.two }}>
                          {mappedItems.length} mapped {mappedItems.length === 1 ? 'place' : 'places'}
                        </ThemedText>
                        {mappedItems.length > 0 ? (
                          <Pressable
                            onPress={() => router.push({ pathname: '/board/[id]/map', params: { id: board.id } })}
                            style={[styles.mapBtn, { backgroundColor: theme.surfaceCard }]}
                          >
                            <ThemedText type="smallBold">Open interactive map</ThemedText>
                          </Pressable>
                        ) : (
                          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
                            Add stops with coordinates to see them here.
                          </ThemedText>
                        )}
                      </View>
                    </Dissolve>
                  </Reveal>
                ) : null}

                {/* ── Comments ── */}
                <BoardComments boardId={board.id} />
              </>
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>

      {/* Floating action menu */}
      {board && !deleted ? (
        <FloatingActionMenu actions={floatActions} trigger={canEdit ? 'add' : 'ellipsis-horizontal'} />
      ) : null}

      {showAddSection ? (
        <AddSectionModal visible onClose={() => setShowAddSection(false)} onAdd={handleAddSection} />
      ) : null}
      {renameSection ? (
        <AddSectionModal
          visible
          heading="Rename day"
          initialTitle={renameSection.title}
          onClose={() => setRenameSection(null)}
          onAdd={handleRenameSection}
        />
      ) : null}
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
      {id ? <MembersModal visible={showMembers} onClose={() => setShowMembers(false)} boardId={id} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  scrollContent: { paddingBottom: 140 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerText: { textAlign: 'center' },
  primaryButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.five, paddingVertical: Spacing.two + Spacing.half },
  deletedCard: { alignItems: 'center', padding: Spacing.five, gap: Spacing.two, marginTop: Spacing.four },

  // Hero
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  // Stacked translucent bands stand in for a vertical gradient that keeps
  // the title legible over any cover photo (no gradient dependency).
  heroScrimLower: { position: 'absolute', left: 0, right: 0, top: '44%', bottom: 0 },
  heroScrimBase: { position: 'absolute', left: 0, right: 0, top: '68%', bottom: 0 },
  heroControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  heroRightControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackOverlap: {},
  heroBody: { padding: Spacing.three, gap: Spacing.two },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + Spacing.half },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  pillTextOn: { color: '#fff', fontSize: 11 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4FB98C' },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap' },
  breadcrumbText: { color: 'rgba(255,255,255,0.92)', fontWeight: '600' },
  breadcrumbSep: { color: 'rgba(255,255,255,0.6)' },

  // Stat bar
  statBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  description: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },

  // Tabs
  segment: {
    flexDirection: 'row',
    margin: Spacing.three,
    padding: Spacing.half,
    borderRadius: Radius.full,
    gap: Spacing.one,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  // Sections / days
  sections: { paddingHorizontal: Spacing.three, gap: Spacing.five },
  dayBlock: { gap: Spacing.two },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  dayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.full,
  },
  dayChipRow: { gap: Spacing.two, paddingRight: Spacing.two, paddingBottom: Spacing.one },
  dayHeaderText: { flex: 1, gap: 2 },
  dayTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  sectionControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingLeft: Spacing.one },
  sectionCtl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.half + 2,
    borderRadius: Radius.full,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noStops: { paddingLeft: Spacing.four, paddingVertical: Spacing.two },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
  },

  // Timeline
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: Spacing.two },
  timeCol: { width: 20, alignItems: 'center', paddingTop: Spacing.two + Spacing.one },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  line: { width: 2, flex: 1, marginTop: 2, borderRadius: 1 },
  itemCardWrap: { flex: 1, paddingBottom: Spacing.three },
  itemCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.two + Spacing.half,
    gap: Spacing.one + Spacing.half,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  itemBody: { flexDirection: 'row', gap: Spacing.two },
  itemThumb: { width: 62, height: 62, borderRadius: Radius.md },
  itemBodyText: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  itemDescription: { lineHeight: 18 },
  chipRow: { flexDirection: 'row', gap: Spacing.one + Spacing.half, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
    paddingTop: Spacing.one + Spacing.half,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionTile: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Places grid
  placesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  placeCell: { width: '48%', flexGrow: 1 },
  placeCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  placeImage: { width: '100%', aspectRatio: 16 / 10 },
  placeImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  placeBody: { padding: Spacing.two + Spacing.half, gap: 2 },

  // Map panel
  mapPanel: { paddingHorizontal: Spacing.three },
  mapDissolve: { borderRadius: Radius.xl, overflow: 'hidden' },
  mapInner: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.one },
  mapBtn: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.full,
  },

  emptyCard: {
    margin: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.four },
  modalCard: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.three, maxHeight: '80%' },
  modalTitle: { marginBottom: Spacing.one },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.three },
  modalCancelBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  modalPrimaryBtn: { borderRadius: Radius.full, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  addMemberRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  addMemberInput: { flex: 1 },
  addMemberBtn: { borderRadius: Radius.full, paddingVertical: Spacing.two + Spacing.half, paddingHorizontal: Spacing.four, alignItems: 'center' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: { flex: 1 },
  memberActions: { flexDirection: 'row', gap: Spacing.three },
});
