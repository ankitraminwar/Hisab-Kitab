import { enqueueSync, getDatabase } from '../database';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/constants';
import type { Note } from '../utils/types';
import { triggerBackgroundSync } from './syncService';

const createSyncMetadata = () => ({
  userId: null,
  syncStatus: 'pending' as const,
  lastSyncedAt: null,
  deletedAt: null,
});

const queueEntitySync = async (
  table: string,
  id: string,
  payload: Record<string, unknown>,
  operation: 'upsert' | 'delete' = 'upsert',
) => {
  await enqueueSync(table, id, operation, payload);
  useAppStore.getState().bumpDataRevision();
  triggerBackgroundSync(`${table}-${operation}`).catch(console.warn);
};

export const NoteService = {
  async getAll(): Promise<Note[]> {
    const rows = await getDatabase().getAllAsync<Note>(
      'SELECT * FROM notes WHERE deletedAt IS NULL ORDER BY isPinned DESC, updatedAt DESC',
    );
    return rows.map((row) => ({ ...row, isPinned: Boolean(row.isPinned) }));
  },

  async getById(id: string): Promise<Note | null> {
    const row = await getDatabase().getFirstAsync<Note>(
      'SELECT * FROM notes WHERE id = ? AND deletedAt IS NULL',
      [id],
    );
    return row ? { ...row, isPinned: Boolean(row.isPinned) } : null;
  },

  async create(
    data: Omit<
      Note,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
  ): Promise<string> {
    const now = new Date().toISOString();
    const note: Note = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO notes
        (id, title, content, color, isPinned, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.title,
        note.content,
        note.color,
        note.isPinned ? 1 : 0,
        note.createdAt,
        note.updatedAt,
        note.userId ?? null,
        note.syncStatus,
        note.lastSyncedAt ?? null,
        note.deletedAt ?? null,
      ],
    );

    await queueEntitySync('notes', note.id, {
      ...note,
      isPinned: note.isPinned ? 1 : 0,
    } as Record<string, unknown>);
    return note.id;
  },

  async update(id: string, data: Partial<Pick<Note, 'title' | 'content' | 'color' | 'isPinned'>>) {
    const existing = await getDatabase().getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [
      id,
    ]);
    if (!existing) {
      throw new Error('Note not found');
    }

    const updatedAt = new Date().toISOString();
    const note = {
      ...existing,
      ...data,
      updatedAt,
      syncStatus: 'pending' as const,
    };

    await getDatabase().runAsync(
      `UPDATE notes
       SET title = ?, content = ?, color = ?, isPinned = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [note.title, note.content, note.color, note.isPinned ? 1 : 0, note.updatedAt, id],
    );

    await queueEntitySync('notes', id, {
      ...note,
      isPinned: note.isPinned ? 1 : 0,
    } as Record<string, unknown>);
  },

  async delete(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE notes SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('notes', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },

  async togglePin(id: string, currentPinStatus: boolean) {
    await this.update(id, { isPinned: !currentPinStatus });
  },
};
