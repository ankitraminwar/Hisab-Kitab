-- UP
-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#7C3AED',
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Turn on RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Enable real-time for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;

-- Add updated_at trigger
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Policies for public.notes

-- INSERT: User can only insert their own notes
CREATE POLICY "Users can create their own notes"
ON public.notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- SELECT: User can view only their own notes
CREATE POLICY "Users can view their own notes"
ON public.notes FOR SELECT
USING (auth.uid() = user_id);

-- UPDATE: User can update only their own notes
CREATE POLICY "Users can update their own notes"
ON public.notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: User can delete only their own notes
CREATE POLICY "Users can delete their own notes"
ON public.notes FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted ON public.notes(user_id, deleted_at);

-- DOWN
-- DROP INDEX IF EXISTS idx_notes_user_deleted;
-- DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
-- DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
-- DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
-- DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
-- DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.notes;
-- DROP TABLE IF EXISTS public.notes;
