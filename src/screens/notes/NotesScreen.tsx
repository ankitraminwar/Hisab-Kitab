import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CustomModal, EmptyState } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { NoteService } from '../../services/noteService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import type { Note } from '../../utils/types';

const NOTE_COLORS = [
  '#7C3AED',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#F43F5E',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
];

const CARD_GAP = SPACING.md;

// ─── Sticky Note Card ─────────────────────────────────────────────────────────
const StickyNoteCard = ({
  item,
  isDark,
  colors,
  styles,
  onPress,
  onLongPress,
}: {
  item: Note;
  isDark: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const bgColor = isDark ? `${item.color}22` : `${item.color}18`;

  return (
    <Animated.View style={[animStyle, styles.noteCardWrapper]}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={400}
        style={[styles.noteCard, { backgroundColor: bgColor, borderColor: `${item.color}55` }]}
      >
        {/* Colored top accent bar */}
        <View style={[styles.noteAccentBar, { backgroundColor: item.color }]} />

        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title || 'Untitled'}
          </Text>
          {item.isPinned && (
            <Ionicons name="pin" size={13} color={item.color} style={styles.pinIcon} />
          )}
        </View>

        {!!item.content && (
          <Text style={[styles.noteContent, { color: colors.textPrimary }]} numberOfLines={7}>
            {item.content}
          </Text>
        )}

        <Text style={[styles.noteDate, { color: `${item.color}BB` }]}>
          {new Date(item.updatedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Masonry 2-Column Grid ────────────────────────────────────────────────────
const NoteGrid = ({
  notes,
  isDark,
  colors,
  styles,
  onEdit,
  onLongPress,
}: {
  notes: Note[];
  isDark: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onEdit: (note: Note) => void;
  onLongPress: (note: Note) => void;
}) => {
  if (notes.length === 0) return null;

  const left: Note[] = [];
  const right: Note[] = [];
  notes.forEach((n, i) => (i % 2 === 0 ? left : right).push(n));

  return (
    <View style={styles.gridRow}>
      <View style={styles.gridColumn}>
        {left.map((item) => (
          <StickyNoteCard
            key={item.id}
            item={item}
            isDark={isDark}
            colors={colors}
            styles={styles}
            onPress={() => onEdit(item)}
            onLongPress={() => onLongPress(item)}
          />
        ))}
      </View>
      <View style={styles.gridColumn}>
        {right.map((item) => (
          <StickyNoteCard
            key={item.id}
            item={item}
            isDark={isDark}
            colors={colors}
            styles={styles}
            onPress={() => onEdit(item)}
            onLongPress={() => onLongPress(item)}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotesScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);

  const [notes, setNotes] = useState<Note[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [longPressNote, setLongPressNote] = useState<Note | null>(null);
  const [showPinMenu, setShowPinMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadNotes();
  }, [dataRevision]);

  const loadNotes = async () => {
    const data = await NoteService.getAll();
    data.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    setNotes(data);
  };

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setShowAdd(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  // Long-press: quick-action sheet where pin/unpin moves card between sections
  const handleLongPress = useCallback((note: Note) => {
    setLongPressNote(note);
    setShowPinMenu(true);
  }, []);

  const handleTogglePin = useCallback(async (note: Note) => {
    await NoteService.togglePin(note.id, note.isPinned);
    setShowPinMenu(false);
    setLongPressNote(null);
    void loadNotes();
  }, []);

  const closePinMenu = useCallback(() => {
    setShowPinMenu(false);
    setLongPressNote(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notes" />

      {notes.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ flex: 1, padding: SPACING.lg }}>
          <EmptyState
            icon="document-text-outline"
            title="No notes yet"
            subtitle="Jot down your financial thoughts, reminders, or ideas."
            action="Create Note"
            onAction={() => setShowAdd(true)}
          />
        </Animated.View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadNotes();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── PINNED section ── */}
          {pinnedNotes.length > 0 && (
            <Animated.View entering={FadeInUp.duration(250)}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pin" size={13} color={colors.primary} />
                <Text style={styles.sectionLabel}>PINNED</Text>
              </View>
              <NoteGrid
                notes={pinnedNotes}
                isDark={isDark}
                colors={colors}
                styles={styles}
                onEdit={handleEdit}
                onLongPress={handleLongPress}
              />
            </Animated.View>
          )}

          {/* ── ALL NOTES section ── */}
          {unpinnedNotes.length > 0 && (
            <Animated.View entering={FadeInUp.duration(300).delay(pinnedNotes.length > 0 ? 60 : 0)}>
              {pinnedNotes.length > 0 && (
                <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
                  <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ALL NOTES</Text>
                </View>
              )}
              <NoteGrid
                notes={unpinnedNotes}
                isDark={isDark}
                colors={colors}
                styles={styles}
                onEdit={handleEdit}
                onLongPress={handleLongPress}
              />
            </Animated.View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          setEditingNote(null);
          setShowAdd(true);
        }}
        activeOpacity={0.8}
        accessibilityLabel="Add note"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

      {/* Long-press quick actions — pin moves between sections */}
      <CustomModal visible={showPinMenu} onClose={closePinMenu} hideCloseBtn>
        <Text
          style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary, marginBottom: SPACING.md }}
          numberOfLines={2}
        >
          {longPressNote?.title || 'Note'}
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (longPressNote) void handleTogglePin(longPressNote);
          }}
          style={styles.menuItem}
        >
          <Ionicons
            name={longPressNote?.isPinned ? 'pin-outline' : 'pin'}
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
            {longPressNote?.isPinned ? 'Unpin — move to All Notes' : 'Pin — move to top section'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (longPressNote) {
              setShowPinMenu(false);
              setEditingNote(longPressNote);
              setLongPressNote(null);
              setShowAdd(true);
            }
          }}
          style={styles.menuItem}
        >
          <Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Edit Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (longPressNote) {
              const id = longPressNote.id;
              setShowPinMenu(false);
              setLongPressNote(null);
              handleDelete(id);
            }
          }}
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.expense} />
          <Text style={[styles.menuItemText, { color: colors.expense }]}>Delete Note</Text>
        </TouchableOpacity>

        <Button
          title="Cancel"
          variant="secondary"
          onPress={closePinMenu}
          style={{ marginTop: SPACING.md }}
        />
      </CustomModal>

      {/* Delete confirmation */}
      <CustomModal visible={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} hideCloseBtn>
        <Text style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary, marginBottom: SPACING.sm }}>
          Delete Note
        </Text>
        <Text style={{ ...TYPOGRAPHY.body, color: colors.textSecondary, marginBottom: SPACING.lg }}>
          Are you sure you want to delete this note?
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setDeleteTargetId(null)}
            style={{ flex: 1 }}
          />
          <Button
            title="Delete"
            onPress={() => {
              if (deleteTargetId) {
                void NoteService.delete(deleteTargetId).then(() => {
                  setDeleteTargetId(null);
                  void loadNotes();
                });
              }
            }}
            style={{ flex: 1, backgroundColor: colors.expense }}
          />
        </View>
      </CustomModal>

      {/* Note editor */}
      <NoteEditorModal
        visible={showAdd}
        note={editingNote}
        onClose={() => {
          setShowAdd(false);
          setEditingNote(null);
        }}
        onSave={() => {
          void loadNotes();
          setShowAdd(false);
          setEditingNote(null);
        }}
        onDelete={handleDelete}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ─── Note Editor Modal ────────────────────────────────────────────────────────
const NoteEditorModal = ({
  visible,
  note,
  onClose,
  onSave,
  onDelete,
  colors,
}: {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  colors: ThemeColors;
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setContent(note?.content ?? '');
      setColor(note?.color ?? NOTE_COLORS[0]);
      setIsPinned(note?.isPinned ?? false);
    }
  }, [visible, note]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    setLoading(true);
    try {
      if (note) {
        await NoteService.update(note.id, {
          title: title.trim(),
          content: content.trim(),
          color,
          isPinned,
        });
      } else {
        await NoteService.create({
          title: title.trim(),
          content: content.trim(),
          color,
          isPinned,
        });
      }
      onSave();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomModal visible={visible} onClose={onClose} hideCloseBtn>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.md,
        }}
      >
        <Text style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary }}>
          {note ? 'Edit Note' : 'New Note'}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <TouchableOpacity onPress={() => setIsPinned(!isPinned)}>
            <Ionicons
              name={isPinned ? 'pin' : 'pin-outline'}
              size={22}
              color={isPinned ? color : colors.textMuted}
            />
          </TouchableOpacity>
          {note && (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onDelete(note.id);
              }}
            >
              <Ionicons name="trash-outline" size={22} color={colors.expense} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={{
            ...TYPOGRAPHY.h2,
            color: colors.textPrimary,
            marginBottom: SPACING.md,
            paddingVertical: SPACING.sm,
          }}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={{
            ...TYPOGRAPHY.body,
            color: colors.textPrimary,
            minHeight: 120,
            textAlignVertical: 'top',
            marginBottom: SPACING.lg,
            lineHeight: 22,
          }}
          placeholder="Write your note down here..."
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
        />

        <View style={{ marginBottom: SPACING.xl }}>
          <Text style={{ ...TYPOGRAPHY.label, color: colors.textMuted, marginBottom: SPACING.sm }}>
            COLOR
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
            {NOTE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: c,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: color === c ? 0.4 : 0.1,
                  shadowRadius: 8,
                  elevation: color === c ? 6 : 2,
                }}
              >
                {color === c && <Ionicons name="checkmark" size={20} color={colors.heroText} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title="Save Note"
            onPress={() => void handleSave()}
            loading={loading}
            style={{ flex: 1, backgroundColor: color }}
            disabled={!title.trim() && !content.trim()}
          />
        </View>
      </ScrollView>
    </CustomModal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      padding: SPACING.md,
    },
    // 2-column masonry grid
    gridRow: {
      flexDirection: 'row',
      gap: CARD_GAP,
    },
    gridColumn: {
      flex: 1,
    },
    // Section header row
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      letterSpacing: 1.5,
    },
    // Sticky note card
    noteCardWrapper: {
      marginBottom: CARD_GAP,
    },
    noteCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md + 6, // room for accent bar
      paddingBottom: SPACING.md,
      minHeight: 130,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    noteAccentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 5,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: SPACING.xs,
    },
    noteTitle: {
      ...TYPOGRAPHY.bodyMedium,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
      lineHeight: 20,
    },
    pinIcon: {
      marginLeft: 4,
      marginTop: 3,
    },
    noteContent: {
      ...TYPOGRAPHY.caption,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: SPACING.sm,
    },
    noteDate: {
      ...TYPOGRAPHY.caption,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'right',
      marginTop: SPACING.xs,
    },
    // Long-press quick-action menu
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuItemText: {
      ...TYPOGRAPHY.body,
      fontWeight: '500',
      flex: 1,
    },
    // FAB
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
  });
