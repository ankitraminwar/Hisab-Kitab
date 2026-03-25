import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CustomModal, EmptyState } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { NoteService } from '../../services/noteService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import type { Note } from '../../utils/types';

const NOTE_COLORS = [
  '#7C3AED', // Primary
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#64748B', // Slate
];

export default function NotesScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);

  const [notes, setNotes] = useState<Note[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    loadNotes();
  }, [dataRevision]);

  const loadNotes = async () => {
    const data = await NoteService.getAll();
    setNotes(data);
  };

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const otherNotes = notes.filter((n) => !n.isPinned);

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await NoteService.delete(id);
          loadNotes();
        },
      },
    ]);
  };

  const handleTogglePin = async (note: Note) => {
    await NoteService.togglePin(note.id, note.isPinned);
    loadNotes();
  };

  const renderNoteCard = (note: Note, index: number) => (
    <Animated.View
      key={note.id}
      layout={Layout.springify().damping(14)}
      entering={FadeInUp.delay(index * 100)
        .springify()
        .damping(14)}
      style={[
        styles.noteCard,
        {
          backgroundColor: isDark ? `${note.color}1A` : `${note.color}15`,
          borderColor: isDark ? `${note.color}30` : `${note.color}40`,
        },
      ]}
    >
      <TouchableOpacity onPress={() => handleEdit(note)} style={{ flex: 1 }} activeOpacity={0.7}>
        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {note.title || 'Untitled Note'}
          </Text>
          <TouchableOpacity
            onPress={() => handleTogglePin(note)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={note.isPinned ? 'pin' : 'pin-outline'}
              size={20}
              color={note.isPinned ? note.color : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.noteContent, { color: colors.textSecondary }]} numberOfLines={5}>
          {note.content || 'No content...'}
        </Text>
        <View style={styles.noteFooter}>
          <View style={[styles.colorIndicator, { backgroundColor: note.color }]} />
          <Text style={styles.noteDate}>
            {new Date(note.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notes" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <EmptyState
              icon="document-text-outline"
              title="No notes yet"
              subtitle="Jot down your financial thoughts, reminders, or ideas."
              action="Create Note"
              onAction={() => setShowAdd(true)}
            />
          </Animated.View>
        ) : (
          <View style={styles.grid}>
            {pinnedNotes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PINNED</Text>
                <View style={styles.masonry}>
                  <View style={styles.column}>
                    {pinnedNotes.filter((_, i) => i % 2 === 0).map((n, i) => renderNoteCard(n, i))}
                  </View>
                  <View style={styles.column}>
                    {pinnedNotes.filter((_, i) => i % 2 !== 0).map((n, i) => renderNoteCard(n, i))}
                  </View>
                </View>
              </View>
            )}

            {otherNotes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>OTHERS</Text>
                <View style={styles.masonry}>
                  <View style={styles.column}>
                    {otherNotes.filter((_, i) => i % 2 === 0).map((n, i) => renderNoteCard(n, i))}
                  </View>
                  <View style={styles.column}>
                    {otherNotes.filter((_, i) => i % 2 !== 0).map((n, i) => renderNoteCard(n, i))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          setEditingNote(null);
          setShowAdd(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      <NoteEditorModal
        visible={showAdd}
        note={editingNote}
        onClose={() => {
          setShowAdd(false);
          setEditingNote(null);
        }}
        onSave={() => {
          loadNotes();
          setShowAdd(false);
          setEditingNote(null);
        }}
        onDelete={handleDelete}
        colors={colors}
      />
    </SafeAreaView>
  );
}

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
      setTitle(note?.title || '');
      setContent(note?.content || '');
      setColor(note?.color || NOTE_COLORS[0]);
      setIsPinned(note?.isPinned || false);
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
            color: colors.textSecondary,
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
                style={[
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: c,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: color === c ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: color === c ? 6 : 2,
                  },
                ]}
              >
                {color === c && <Ionicons name="checkmark" size={20} color="#FFF" />}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.lg },
    grid: { flex: 1 },
    section: { marginBottom: SPACING.xxl },
    sectionTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginBottom: SPACING.md,
      marginLeft: 4,
      letterSpacing: 1.5,
    },
    masonry: { flexDirection: 'row', gap: SPACING.md },
    column: { flex: 1, gap: SPACING.md },
    noteCard: {
      padding: SPACING.lg,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      minHeight: 120,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.sm,
    },
    noteTitle: {
      ...TYPOGRAPHY.h3,
      fontWeight: '800',
      flex: 1,
      marginRight: SPACING.sm,
      lineHeight: 24,
    },
    noteContent: {
      ...TYPOGRAPHY.bodyMedium,
      lineHeight: 22,
      marginBottom: SPACING.lg,
      opacity: 0.8,
    },
    noteFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 'auto',
    },
    colorIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    noteDate: {
      ...TYPOGRAPHY.caption,
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
  });
