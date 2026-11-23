
import React, { useEffect,useRef, useState } from 'react';
import * as tus from 'tus-js-client'
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Folder, 
  FolderPlus,
  Upload, 
  FileText, 
  Download,
  Pencil,
  Trash
 } from 'lucide-react';

import MarketingLayout from './MarketingLayout';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const generateFileId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.random() * 16 | 0;
      const value = character === 'x'
        ? random
        : (random & 0x3) | 0x8;

      return value.toString(16);
    }
  );
};

const MarketingFolderContents: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [folder, setFolder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

 const [editingItemId, setEditingItemId] = useState<string | null>(null);
const [editingItemName, setEditingItemName] = useState('');
  
const uploadFile = async (file: File) => {
  if (!id || !file) return;

  setUploading(true);
  setUploadProgress(0);
  setUploadError('');

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!authData.user) throw new Error('Please sign in first.');

   const fileId = generateFileId();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${id}/${fileId}-${safeName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) throw new Error('Your session has expired.');

    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: supabaseKey,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'marketing-files',
        objectName: storagePath,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        setUploadError(error.message);
        setUploading(false);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: async () => {
        const { error } = await (supabase as any)
          .from('fms_marketing_items')
          .insert({
            name: file.name,
            item_type: 'file',
            parent_id: id,
            storage_path: storagePath,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            created_by: authData.user.id,
            metadata: {},
          });

        if (error) {
          await supabase.storage
            .from('marketing-files')
            .remove([storagePath]);

          setUploadError(error.message);
        } else {
          await loadContents();
        }

        setUploading(false);
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  } catch (error: any) {
    setUploadError(error.message || 'Upload failed.');
    setUploading(false);
  }
};

const downloadFile = async (item: any) => {
  if (!item.storage_path) return;

  const { data, error } = await supabase.storage
    .from('marketing-files')
    .download(item.storage_path);

  if (error) {
    console.error('Download error:', error);
    setUploadError(`Could not download ${item.name}: ${error.message}`);
    return;
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');

  link.href = url;
  link.download = item.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};


const renameItem = async (itemId: string) => {
  const name = editingItemName.trim();

  if (!name) {
    setUploadError('Please enter a name.');
    return;
  }

  try {
    const { error } = await (supabase as any)
      .from('fms_marketing_items')
      .update({ name })
      .eq('id', itemId);

    if (error) throw error;

    setEditingItemId(null);
    setEditingItemName('');
    setUploadError('');
    await loadContents();
  } catch (error: any) {
    setUploadError(error.message || 'Could not rename item.');
  }
};

const deleteItem = async (item: any) => {
  const confirmed = window.confirm(
    item.item_type === 'folder'
      ? `Delete "${item.name}" and EVERYTHING inside it? This includes all nested folders and uploaded files. This cannot be undone.`
      : `Delete "${item.name}"? This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    setUploadError('');

    const ids: string[] = [item.id];
    const storagePaths: string[] = [];

    if (item.storage_path) {
      storagePaths.push(item.storage_path);
    }

    const collectFolderContents = async (folderId: string) => {
      const { data, error } = await (supabase as any)
        .from('fms_marketing_items')
        .select('id, item_type, storage_path')
        .eq('parent_id', folderId);

      if (error) throw error;

      for (const child of data || []) {
        ids.push(child.id);

        if (child.storage_path) {
          storagePaths.push(child.storage_path);
        }

        if (child.item_type === 'folder') {
          await collectFolderContents(child.id);
        }
      }
    };

    if (item.item_type === 'folder') {
      await collectFolderContents(item.id);
    }

    // Remove uploaded files from Supabase Storage.
    for (let i = 0; i < storagePaths.length; i += 100) {
      const batch = storagePaths.slice(i, i + 100);

      const { error } = await supabase.storage
        .from('marketing-files')
        .remove(batch);

      if (error) throw error;
    }

    // Delete all database records, including nested folders.
    const { error } = await (supabase as any)
      .from('fms_marketing_items')
      .delete()
      .in('id', ids);

    if (error) throw error;

    await loadContents();
  } catch (error: any) {
    console.error('Delete item error:', error);
    setUploadError(
      error.message || 'Could not delete item and its contents.'
    );
  }
};

const createSubfolder = async () => {
  const name = newFolderName.trim();

  if (!name || !id) return;

  setCreatingFolder(true);
  setUploadError('');

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!authData.user) throw new Error('Please sign in first.');

    const { error } = await (supabase as any)
      .from('fms_marketing_items')
      .insert({
        name,
        item_type: 'folder',
        parent_id: id,
        created_by: authData.user.id,
        metadata: {},
      });

    if (error) throw error;

    setNewFolderName('');
    setShowCreateFolder(false);

    await loadContents();
  } catch (error: any) {
    console.error('Create subfolder error:', error);
    setUploadError(error.message || 'Could not create folder.');
  } finally {
    setCreatingFolder(false);
  }
};

  const loadContents = async () => {
    if (!id) return;

    setLoading(true);

    const { data: folderData, error: folderError } = await (supabase as any)
      .from('fms_marketing_items')
      .select('id, name')
      .eq('id', id)
      .eq('item_type', 'folder')
      .single();

    if (folderError) {
      console.error(folderError);
      setFolder(null);
      setLoading(false);
      return;
    }

    setFolder(folderData);

    const { data: itemData, error: itemError } = await (supabase as any)
      .from('fms_marketing_items')
      .select('*')
      .eq('parent_id', id)
      .order('created_at', { ascending: false });

    if (itemError) {
      console.error(itemError);
    } else {
      setItems(itemData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadContents();
  }, [id]);

  
return (
  <MarketingLayout>
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/marketing-system/folders')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">
              {folder?.name || 'Folder'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length} items
            </p>
          </div>
        </div>

<div className="flex items-center gap-2">
  <Button
    variant="outline"
    onClick={() => setShowCreateFolder(!showCreateFolder)}
  >
    <FolderPlus className="mr-2 h-4 w-4" />
    Add Folder
  </Button>

  <Button
    onClick={() => fileInputRef.current?.click()}
    disabled={uploading}
  >
    <Upload className="mr-2 h-4 w-4" />
    {uploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}
  </Button>
</div>
      
        

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            files.forEach(uploadFile);
            event.target.value = '';
          }}
        />
      </div>
{showCreateFolder && (
  <Card>
    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
      <input
        type="text"
        placeholder="Enter subfolder name..."
        value={newFolderName}
        onChange={(event) => setNewFolderName(event.target.value)}
        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        disabled={creatingFolder}
      />

      <Button
        onClick={createSubfolder}
        disabled={creatingFolder || !newFolderName.trim()}
      >
        {creatingFolder ? 'Creating...' : 'Create Folder'}
      </Button>

      <Button
        variant="outline"
        onClick={() => {
          setShowCreateFolder(false);
          setNewFolderName('');
        }}
        disabled={creatingFolder}
      >
        Cancel
      </Button>
    </CardContent>
  </Card>
)}

      {/* Upload Progress */}
      {uploading && (
        <p className="text-sm text-muted-foreground">
          Upload progress: {uploadProgress}%
        </p>
      )}

      {/* Upload Error */}
      {uploadError && (
        <p className="text-sm text-destructive">
          {uploadError}
        </p>
      )}

      {/* Folder Contents */}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading folder...
        </p>
      ) : !folder ? (
        <p className="py-10 text-center text-sm text-destructive">
          Folder not found or you do not have access.
        </p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Folder className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-semibold">This folder is empty</h3>
            <p className="text-sm text-muted-foreground">
              Upload files to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map((item) => (
    <Card
      key={item.id}
      className={`group transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
        item.item_type === 'folder'
          ? 'cursor-pointer hover:border-primary/40'
          : 'hover:border-primary/30'
      }`}
      onClick={() => {
        if (item.item_type === 'folder') {
          navigate(
            `/marketing-system/folder/${encodeURIComponent(item.id)}`
          );
        }
      }}
    >
      <CardContent className="relative flex min-h-[190px] flex-col p-4">
        <div className="absolute right-2 top-2 z-10 flex gap-1">
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    title="Rename"
    onClick={(event) => {
      event.stopPropagation();
      setEditingItemId(item.id);
      setEditingItemName(item.name);
    }}
  >
    <Pencil className="h-3.5 w-3.5" />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7 text-destructive hover:text-destructive"
    title="Delete"
    onClick={(event) => {
      event.stopPropagation();
      deleteItem(item);
    }}
  >
    <Trash className="h-3.5 w-3.5" />
  </Button>
</div>
        <div className="flex justify-center pt-3">
          <div
            className={`rounded-2xl p-5 transition-colors ${
              item.item_type === 'folder'
                ? 'bg-amber-500/10 group-hover:bg-amber-500/20'
                : 'bg-blue-500/10 group-hover:bg-blue-500/20'
            }`}
          >
            {item.item_type === 'folder' ? (
              <Folder className="h-10 w-10 text-amber-600" />
            ) : (
              <FileText className="h-10 w-10 text-blue-600" />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
        {editingItemId === item.id ? (
  <div
    className="w-full space-y-2"
    onClick={(event) => event.stopPropagation()}
  >
    <input
      value={editingItemName}
      onChange={(event) => setEditingItemName(event.target.value)}
      className="w-full rounded-md border bg-background px-2 py-1 text-center text-sm"
      autoFocus
    />

    <div className="flex justify-center gap-2">
      <Button size="sm" onClick={() => renameItem(item.id)}>
        Save
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setEditingItemId(null);
          setEditingItemName('');
        }}
      >
        Cancel
      </Button>
    </div>
  </div>
) : (
  <h3
    className="w-full break-words text-sm font-semibold leading-snug"
    title={item.name}
  >
    {item.name}
  </h3>
)}

          <p className="mt-1 text-xs text-muted-foreground">
            {item.item_type === 'folder'
              ? 'Folder'
              : item.mime_type || 'Document'}
          </p>
        </div>

        {item.item_type === 'file' && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(event) => {
                event.stopPropagation();
                downloadFile(item);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  ))}
</div>
      )}

    </div>
  </MarketingLayout>
  );
};

export default MarketingFolderContents;