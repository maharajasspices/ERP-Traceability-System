
import React, { useEffect, useState } from 'react';
import {
  Folder,
  FolderPlus,
  Search,
  ChevronRight,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from 'lucide-react';

import { useFMSAuth } from '@/context/FMSAuthContext';

import MarketingLayout from './MarketingLayout';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

const defaultFolders = [
  'Deli-ish Workspace',
  'Photography Workspace',
  'Signage Workspace',
  'Social Media & Retail Workspace',
  'Marketing Content',
  'BDM Catalogues',
  "Maharaja's Product Design",
  'Image Library',
];

interface WorkspaceFolder {
  id: string;
  name: string;
  createdAt: string;
}

const MarketingFolders: React.FC = () => {
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [search, setSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { user, loading: authLoading } = useFMSAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
const [editingFolderName, setEditingFolderName] = useState('');

  // Load folders from Supabase
  const loadFolders = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('fms_marketing_items')
        .select('id, name, created_at, metadata')
        .eq('item_type', 'folder')
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      let folderData = data || [];

      // Create the original workspace folders on first use
      if (folderData.length === 0) {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          throw new Error('Please sign in to access the Marketing Workspace.');
        }

        const initialFolders = defaultFolders.map((name) => ({
          name,
          item_type: 'folder',
          parent_id: null,
          created_by: user.id,
          metadata: { is_default: true },
        }));

        const { error: insertError } = await supabase
          .from('fms_marketing_items')
          .insert(initialFolders);

        if (insertError) throw insertError;

        const { data: refreshedData, error: refreshError } =
          await supabase
            .from('fms_marketing_items')
            .select('id, name, created_at, metadata')
            .eq('item_type', 'folder')
            .is('parent_id', null)
            .order('created_at', { ascending: true });

        if (refreshError) throw refreshError;

        folderData = refreshedData || [];
      }

      setFolders(
        folderData.map((folder) => ({
          id: folder.id,
          name: folder.name,
          createdAt: folder.metadata?.is_default
            ? 'Main workspace'
            : new Date(folder.created_at).toLocaleDateString(),
        }))
      );
    } catch (err: any) {
      console.error('Error loading Marketing folders:', err);
      setError(err.message || 'Could not load folders.');
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => {
  if (!authLoading && user) {
    loadFolders();
  }
}, [authLoading, user]);

  // Create a new folder
  const createFolder = async () => {
    const name = newFolderName.trim();

    if (!name) {
      alert('Please enter a folder name.');
      return;
    }

    const alreadyExists = folders.some(
      (folder) => folder.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert('A folder with this name already exists.');
      return;
    }

    setSaving(true);
    setError('');

    try {
     if (!user) {
    throw new Error('Please sign in to access the Marketing Workspace.');
    }

      const { error: insertError } = await supabase
        .from('fms_marketing_items')
        .insert({
          name,
          item_type: 'folder',
          parent_id: null,
          created_by: user.id,
          metadata: {},
        });

      if (insertError) throw insertError;

setNewFolderName('');
setShowCreateFolder(false);

await loadFolders();

window.dispatchEvent(
  new Event('marketing-folders-updated')
);
    } catch (err: any) {
      console.error('Error creating Marketing folder:', err);
      setError(err.message || 'Could not create folder.');
    } finally {
      setSaving(false);
    }
  };

  const updateFolder = async () => {
  const name = editingFolderName.trim();

  if (!name || !editingFolderId) return;

  const alreadyExists = folders.some(
    (folder) =>
      folder.id !== editingFolderId &&
      folder.name.toLowerCase() === name.toLowerCase()
  );

  if (alreadyExists) {
    alert('A folder with this name already exists.');
    return;
  }

  try {
    const { error } = await supabase
      .from('fms_marketing_items')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', editingFolderId);

    if (error) throw error;

    setEditingFolderId(null);
    setEditingFolderName('');

    await loadFolders();

    window.dispatchEvent(new Event('marketing-folders-updated'));
  } catch (err: any) {
    alert(err.message || 'Could not update folder.');
  }
};

const deleteFolder = async (folder: WorkspaceFolder) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${folder.name}"?`
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('fms_marketing_items')
      .delete()
      .eq('id', folder.id);

    if (error) throw error;

    await loadFolders();

    window.dispatchEvent(new Event('marketing-folders-updated'));
  } catch (err: any) {
    alert(
      err.message ||
      'Could not delete folder. Make sure it does not contain any subfolders or files.'
    );
  }
};
  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MarketingLayout>
      <div className="space-y-6">

        {/* Page Heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Marketing</span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">
                Workspace
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Maharaja's Workspace
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Browse and organise your shared marketing folders.
            </p>
          </div>

          <Button onClick={() => setShowCreateFolder(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Workspace Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-primary/10 p-3">
                <Folder className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Main Folders
                </p>
                <p className="text-2xl font-bold">
                  {folders.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-blue-500/10 p-3">
                <FolderPlus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Workspace
                </p>
                <p className="text-lg font-semibold">
                  Shared Library
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-green-500/10 p-3">
                <LayoutGrid className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Access
                </p>
                <p className="text-lg font-semibold">
                  Marketing Team
                </p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Create Folder Panel */}
        {showCreateFolder && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">Create New Folder</h2>
                <p className="text-sm text-muted-foreground">
                  Add another folder to Maharaja's Workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(event) =>
                    setNewFolderName(event.target.value)
                  }
                  disabled={saving}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createFolder();
                  }}
                />

                <Button onClick={createFolder} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Folder'}
                </Button>

                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Folder Toolbar */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Workspace Folders</h2>
            <p className="text-sm text-muted-foreground">
              {filteredFolders.length} folders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>

            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>

            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Folders */}
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Loading workspace folders...
            </CardContent>
          </Card>
        ) : filteredFolders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Folder className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="font-semibold">No folders found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or create a new folder.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-2'
            }
          >
            {filteredFolders.map((folder) => (
              <Card
                key={folder.id}
                className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                onClick={() => {
                  window.location.href =
                    `/marketing-system/folder/${encodeURIComponent(folder.id)}`;
                }}
              >
                <CardContent
                  className={
                    viewMode === 'grid'
                      ? 'flex items-center gap-3 p-4'
                      : 'flex items-center justify-between p-4'
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl bg-amber-500/10 p-3">
                      <Folder className="h-6 w-6 text-amber-600" />
                    </div>

                    <div className="min-w-0">
                      {editingFolderId === folder.id ? (
  <div
    className="flex min-w-0 flex-1 items-center gap-2"
    onClick={(event) => event.stopPropagation()}
  >
    <Input
      value={editingFolderName}
      onChange={(event) => setEditingFolderName(event.target.value)}
      className="h-8"
      autoFocus
    />

    <Button size="sm" onClick={updateFolder}>
      Save
    </Button>

    <Button
      size="sm"
      variant="outline"
      onClick={() => setEditingFolderId(null)}
    >
      Cancel
    </Button>
  </div>
) : (
  <div className="min-w-0">
    <h3 className="truncate text-sm font-semibold">
      {folder.name}
    </h3>
    <p className="text-xs text-muted-foreground">
      {folder.createdAt}
    </p>
  </div>
)}
                     
                    </div>
                  </div>

                <div
  className="flex shrink-0 items-center gap-1"
  onClick={(event) => event.stopPropagation()}
>
  {editingFolderId !== folder.id && (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Edit folder"
        onClick={() => {
          setEditingFolderId(folder.id);
          setEditingFolderName(folder.name);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title="Delete folder"
        className="text-destructive hover:text-destructive"
        onClick={() => deleteFolder(folder)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  )}

  <ChevronRight className="h-4 w-4 text-muted-foreground" />
</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </MarketingLayout>
  );
};

export default MarketingFolders;
