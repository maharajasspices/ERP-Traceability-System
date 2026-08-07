import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StickyNote, Plus, Trash2, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { toast } from 'sonner';

interface Note {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
}

export const NotesDropdown: React.FC = () => {
  const { user } = useFMSAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('fms_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setNotes(data as Note[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, [user]);

  const addNote = async () => {
    if (!newNote.trim() || !user) return;
    const { error } = await supabase
      .from('fms_notes')
      .insert({ text: newNote.trim(), user_id: user.id });
    if (error) {
      toast.error('Failed to save note');
      return;
    }
    toast.success('Note saved');
    setNewNote('');
    setIsAdding(false);
    fetchNotes();
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from('fms_notes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete note');
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <StickyNote className="h-5 w-5 text-muted-foreground" />
          {notes.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {notes.length > 9 ? '9+' : notes.length}
            </span>
          )}
          <span className="sr-only">Notes</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>FMS Notes</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              setIsAdding(!isAdding);
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Note
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isAdding && (
          <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <Textarea
              placeholder="Write a note for this Food Manufacturing System..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[60px] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote();
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewNote(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                Save
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : notes.length === 0 && !isAdding ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <StickyNote className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No notes yet</p>
            <p className="text-xs mt-1">Add important notes for the Food Manufacturing System</p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "flex items-start gap-2 p-3 border-b border-border last:border-0 hover:bg-muted/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap break-words">{note.text}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNote(note.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
