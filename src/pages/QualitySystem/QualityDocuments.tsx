
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  Upload,
  Download,
  Trash2,
  ChevronRight,
  Home,
  Search,
  RefreshCw,
  Loader2,
  File,
  Plus,
  FolderPlus,
  Pencil,
  ArrowLeft,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

const db = supabase as any;
const BUCKET = 'quality-documents';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type Factory = 'all' | 'rockwood' | 'nguni';

interface QualityFolder {
  id: string;
  folder_name: string;
  factory: string | null;
  category: string | null;
  parent_folder_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface QualityDocument {
  id: string;
  document_no: string;
  title: string;
  category: string;
  document_type: string;
  version_no: number;
  issue_date: string | null;
  revision_date: string | null;
  compiled_by: string | null;
  approved_by: string | null;
  content: string;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  rockwood: boolean;
  nguni: boolean;
  folder_id: string | null;
  file_path: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-ZA');
};

const QualityDocuments: React.FC = () => {
  const [folders, setFolders] = useState<QualityFolder[]>([]);
  const [documents, setDocuments] = useState<QualityDocument[]>([]);

const location = useLocation();

const factory: Factory =
  location.pathname === '/quality-system/rockwood'
    ? 'rockwood'
    : location.pathname === '/quality-system/nguni'
      ? 'nguni'
      : 'all';

const categoryParam = new URLSearchParams(location.search).get('category');

const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
const [search, setSearch] = useState('');
const [loading, setLoading] = useState(true);
const [uploading, setUploading] = useState(false);

const [isDragging, setIsDragging] = useState(false);

const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
const [selectedUploadFolderId, setSelectedUploadFolderId] = useState<string | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

const [editingFolder, setEditingFolder] = useState<QualityFolder | null>(null);
const [editedFolderName, setEditedFolderName] = useState('');
const [savingFolder, setSavingFolder] = useState(false);

const [error, setError] = useState('');
const [message, setMessage] = useState('');

const [showAddFolder, setShowAddFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');
const [newFolderFactory, setNewFolderFactory] = useState<
  'both' | 'nguni' | 'rockwood' | 'general'
>('both');

const [creatingFolder, setCreatingFolder] = useState(false);



const folderFileInputRef = useRef<HTMLInputElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  setCurrentFolderId(null);
  setSearch('');
  setMessage('');
  setError('');
}, [factory, categoryParam]);

  const currentFolder = folders.find(
    folder => folder.id === currentFolderId
  ) || null;

  const loadData = useCallback(async () => {
  setLoading(true);
  setError('');

  try {
    const [folderResult, documentResult] = await Promise.all([
      db
        .from('fms_quality_folders')
        .select('*')
        .order('folder_name', { ascending: true }),

      db
        .from('fms_quality_documents')
        .select('*')
        .order('updated_at', { ascending: false }),
    ]);

    if (folderResult.error) throw folderResult.error;
    if (documentResult.error) throw documentResult.error;

    const loadedFolders = folderResult.data || [];

    const sortedFolders = [...loadedFolders].sort((a, b) => {
      if (a.factory === 'rockwood' && b.factory === 'rockwood') {
        const getNumber = (name: string) =>
          Number(name.match(/\d+/)?.[0] || 999);

        return getNumber(a.folder_name) - getNumber(b.folder_name);
      }

      // Keep other factories in their existing alphabetical order
      if (a.factory === b.factory) {
        return a.folder_name.localeCompare(b.folder_name);
      }

      return 0;
    });

    setFolders(sortedFolders);
    setDocuments(documentResult.data || []);

  } catch (err: any) {
    console.error('Error loading quality documents:', err);
    setError(err.message || 'Could not load folders and documents.');
  } finally {
    setLoading(false);
  }
}, []);



  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep the selected folder valid when changing factories.
  useEffect(() => {
  if (!currentFolderId) return;

  const selected = folders.find(folder => folder.id === currentFolderId);

  if (!selected) {
    setCurrentFolderId(null);
    return;
  }

  const selectedFactory = selected.factory?.toLowerCase();

  if (
    factory !== 'all' &&
    selectedFactory !== factory &&
    selectedFactory !== 'both' &&
    selectedFactory !== 'general'
  ) {
    setCurrentFolderId(null);
  }
}, [factory, folders, currentFolderId]);

  const getFolderCategory = (folder: QualityFolder): string | null => {
  let current: QualityFolder | undefined = folder;

  while (current) {
    if (current.category) {
      return current.category;
    }

    current = folders.find(
      item => item.id === current?.parent_folder_id
    );
  }

  return null;
};

const visibleFolders = useMemo(() => {
  return folders.filter(folder => {
    const folderFactory = folder.factory?.toLowerCase();

    const matchesFactory =
      factory === 'all' ||
      folderFactory === factory ||
      folderFactory === 'both' ||
      folderFactory === 'general';

    const matchesParent =
      folder.parent_folder_id === currentFolderId;

    const matchesCategory =
      !categoryParam ||
      getFolderCategory(folder)?.toLowerCase() ===
        categoryParam.toLowerCase();

    const matchesSearch =
      !search.trim() ||
      folder.folder_name.toLowerCase().includes(search.toLowerCase());

    return (
      matchesFactory &&
      matchesParent &&
      matchesCategory &&
      matchesSearch
    );
  });
}, [folders, factory, currentFolderId, search, categoryParam]);

  const visibleDocuments = useMemo(() => {
    return documents.filter(document => {
      const matchesFolder =
        document.folder_id === currentFolderId;

      const matchesFactory =
        factory === 'all' ||
        (factory === 'rockwood' && document.rockwood === true) ||
        (factory === 'nguni' && document.nguni === true);

      const searchText = search.toLowerCase();

      const matchesSearch =
        !search.trim() ||
        document.title?.toLowerCase().includes(searchText) ||
        document.document_no?.toLowerCase().includes(searchText) ||
        document.original_file_name?.toLowerCase().includes(searchText);

      return matchesFolder && matchesFactory && matchesSearch;
    });
  }, [documents, factory, currentFolderId, search]);

  const breadcrumbs = useMemo(() => {
    const result: QualityFolder[] = [];
    let folder = currentFolder;

    while (folder) {
      result.unshift(folder);
      folder = folders.find(
        item => item.id === folder?.parent_folder_id
      ) || null;
    }

    return result;
  }, [currentFolder, folders]);

  const openFolder = (folder: QualityFolder) => {
    setCurrentFolderId(folder.id);
    setSearch('');
    setMessage('');
  };

  const goToRoot = () => {
    setCurrentFolderId(null);
    setSearch('');
    setMessage('');
  };

  const getDocumentFactory = (folder: QualityFolder) => {
  const value = folder.factory?.toLowerCase();

  return value === 'rockwood' ||
    value === 'nguni' ||
    value === 'both' ||
    value === 'general'
    ? value
    : null;
};

const handleFolderUpload = (folder: QualityFolder) => {
  setSelectedUploadFolderId(folder.id);
  setUploadingFolderId(folder.id);
  setError('');
  setMessage('');

  setTimeout(() => {
    folderFileInputRef.current?.click();
  }, 0);
};

 const uploadDocuments = async (files: File[]) => {
  if (!files.length) return;

  // Upload into the folder currently open
  if (!currentFolder) {
    setError('Please open a folder before uploading.');
    return;
  }

  const targetFolder = currentFolder;
  const documentFactory = getDocumentFactory(targetFolder);


    if (!documentFactory) {
      setError(
        'This folder does not have a recognised factory. Please check its factory value in fms_quality_folders.'
      );
      return;
    }

    const oversized = files.filter(file => file.size > MAX_FILE_SIZE);

    if (oversized.length) {
      setError(
        `These files exceed the 50 MB limit: ${oversized.map(file => file.name).join(', ')}`
      );
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    let successCount = 0;
    const failures: string[] = [];

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      for (const file of files) {
        const safeName = file.name
          .replace(/[^\w.\-() ]/g, '_')
          .replace(/\s+/g, '_');

          const storageFolder =
            documentFactory === 'both' || documentFactory === 'general'
              ? 'shared'
              : documentFactory;

          const filePath =
            `${storageFolder}/${targetFolder.id}/${Date.now()}_${safeName}`;

        const extension =
          file.name.split('.').pop()?.toUpperCase() || 'FILE';

        try {
          // Upload the physical file to Supabase Storage.
          const { error: storageError } = await db.storage
            .from(BUCKET)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type || undefined,
            });

          if (storageError) throw storageError;

          const documentNo =
            `QDOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now()}`;

          // Save the document details in the database.
          const { error: insertError } = await db
            .from('fms_quality_documents')
            .insert({
              document_no: documentNo,
              title: file.name.replace(/\.[^/.]+$/, ''),
              category: targetFolder.folder_name,
              document_type: extension,
              version_no: 1,
              issue_date: null,
              revision_date: null,
              compiled_by: null,
              approved_by: null,
              content: '',
              status: 'published',
              created_by: userId,
              updated_by: userId,
              folder_id: targetFolder.id,
              file_path: filePath,
              original_file_name: file.name,
              mime_type: file.type || null,
              file_size: file.size,
              uploaded_at: new Date().toISOString(),
              rockwood:
                documentFactory === 'rockwood' ||
                documentFactory === 'both' ||
                documentFactory === 'general',

              nguni:
                documentFactory === 'nguni' ||
                documentFactory === 'both' ||
                documentFactory === 'general',
            });

          if (insertError) {
            // Roll back the Storage upload if the database insert fails.
            await db.storage.from(BUCKET).remove([filePath]);
            throw insertError;
          }

          successCount++;
        } catch (fileError: any) {
          console.error(`Upload failed for ${file.name}:`, fileError);
          failures.push(`${file.name}: ${fileError.message || 'Upload failed'}`);
        }
      }

      if (successCount > 0) {
        setMessage(
          `${successCount} document${successCount === 1 ? '' : 's'} uploaded successfully.`
        );
      }

      if (failures.length) {
        setError(failures.join('\n'));
      }

      await loadData();
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
      setUploadingFolderId(null);
      setSelectedUploadFolderId(null);
    }
  };


const createFolder = async (event: React.FormEvent) => {
  event.preventDefault();

  if (!newFolderName.trim()) {
    setError('Please enter a folder name.');
    return;
  }

  const inheritedCategory = currentFolder
  ? getFolderCategory(currentFolder)
  : categoryParam || newFolderName.trim();

  setCreatingFolder(true);
  setError('');
  setMessage('');

  try {
    const { data: authData } = await supabase.auth.getUser();

    const { error: insertError } = await db
      .from('fms_quality_folders')
      .insert({
        folder_name: newFolderName.trim(),
        factory:
        factory === 'rockwood' || factory === 'nguni'
          ? factory
          : currentFolder?.factory || newFolderFactory,
        category: inheritedCategory,
        parent_folder_id: currentFolderId,
        created_by: authData?.user?.id || null,
      });

    if (insertError) throw insertError;

    setMessage(`"${newFolderName.trim()}" created successfully.`);
    setNewFolderName('');
    setShowAddFolder(false);

    await loadData();
  } catch (err: any) {
    console.error('Create folder error:', err);
    setError(err.message || 'Could not create folder.');
  } finally {
    setCreatingFolder(false);
  }
};


  const downloadDocument = async (document: QualityDocument) => {
    if (!document.file_path) {
      setError('This document does not have a file path saved.');
      return;
    }

    setError('');
    setMessage('');

    try {
      const { data, error: signedUrlError } = await db.storage
        .from(BUCKET)
        .createSignedUrl(document.file_path, 300);

      if (signedUrlError) throw signedUrlError;

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Could not download this document.');
    }
  };

  const deleteDocument = async (document: QualityDocument) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${document.title}"?\n\nThis will permanently delete the file and its database record.`
    );

    if (!confirmed) return;

    setDeletingId(document.id);
    setError('');
    setMessage('');

    try {
      // Remove the physical file first.
      if (document.file_path) {
        const { error: storageError } = await db.storage
          .from(BUCKET)
          .remove([document.file_path]);

        if (storageError) throw storageError;
      }

      // Only remove the database row after Storage deletion succeeds.
      const { error: databaseError } = await db
        .from('fms_quality_documents')
        .delete()
        .eq('id', document.id);

      if (databaseError) {
        throw new Error(
          `The file was removed from Storage, but its database record could not be deleted: ${databaseError.message}`
        );
      }

      setMessage('Document deleted successfully.');
      await loadData();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Could not delete this document.');
    } finally {
      setDeletingId(null);
    }
  };
  const deleteFolder = async (folder: QualityFolder) => {
  // Find this folder and every nested folder beneath it.
  const folderIds = new Set<string>([folder.id]);

  let foundNewFolders = true;

  while (foundNewFolders) {
    foundNewFolders = false;

    folders.forEach(item => {
      if (
        item.parent_folder_id &&
        folderIds.has(item.parent_folder_id) &&
        !folderIds.has(item.id)
      ) {
        folderIds.add(item.id);
        foundNewFolders = true;
      }
    });
  }

  const allFolderIds = Array.from(folderIds);

  setDeletingFolderId(folder.id);
  setError('');
  setMessage('');

  try {
    // Fetch every document stored in these folders.
    const { data: folderDocuments, error: documentsError } = await db
      .from('fms_quality_documents')
      .select('id, title, file_path')
      .in('folder_id', allFolderIds);

    if (documentsError) throw documentsError;

    const documentsToDelete = folderDocuments || [];

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${folder.folder_name}"?\n\n` +
      `This includes:\n` +
      `• ${allFolderIds.length} folder(s), including nested folders\n` +
      `• ${documentsToDelete.length} document(s)\n\n` +
      `All associated uploaded files will also be deleted. This cannot be undone.`
    );

    if (!confirmed) return;

    // Remove uploaded files from Supabase Storage.
    const filePaths = documentsToDelete
      .map((document: any) => document.file_path)
      .filter((path: string | null): path is string => Boolean(path));

    // Remove files in batches.
    for (let i = 0; i < filePaths.length; i += 100) {
      const batch = filePaths.slice(i, i + 100);

      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove(batch);

      if (storageError) {
        throw new Error(
          `Could not remove uploaded files from Storage: ${storageError.message}`
        );
      }
    }

    // Delete the document database records.
    if (documentsToDelete.length > 0) {
      const documentIds = documentsToDelete.map(
        (document: any) => document.id
      );

      const { error: documentDeleteError } = await db
        .from('fms_quality_documents')
        .delete()
        .in('id', documentIds);

      if (documentDeleteError) throw documentDeleteError;
    }

    // Delete all folders, including nested folders.
    const { error: folderDeleteError } = await db
      .from('fms_quality_folders')
      .delete()
      .in('id', allFolderIds);

    if (folderDeleteError) throw folderDeleteError;

    // If the user was inside the deleted folder, return to the root.
    if (folderIds.has(currentFolderId || '')) {
      setCurrentFolderId(null);
    }

    setMessage(
      `"${folder.folder_name}" and all its contents were deleted successfully.`
    );

    await loadData();
  } catch (err: any) {
    console.error('Folder deletion error:', err);
    setError(err.message || 'Could not delete this folder and its contents.');
  } finally {
    setDeletingFolderId(null);
  }
};

//Update Folder
const updateFolder = async (event: React.FormEvent) => {
  event.preventDefault();

  if (!editingFolder || !editedFolderName.trim()) {
    setError('Please enter a folder name.');
    return;
  }

  setSavingFolder(true);
  setError('');
  setMessage('');

  try {
    const { error: updateError } = await db
      .from('fms_quality_folders')
      .update({
        folder_name: editedFolderName.trim(),
      })
      .eq('id', editingFolder.id);

    if (updateError) throw updateError;

    setMessage('Folder renamed successfully.');
    setEditingFolder(null);
    setEditedFolderName('');

    await loadData();
  } catch (err: any) {
    console.error('Folder update error:', err);
    setError(err.message || 'Could not rename folder.');
  } finally {
    setSavingFolder(false);
  }
};

  const selectedFactoryLabel =
    factory === 'all'
      ? 'All factories'
      : factory === 'rockwood'
        ? 'Rockwood'
        : 'Nguni';

  return (
    <div className="space-y-6">
      {/* Page heading */}
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
      {categoryParam || (
        factory === 'rockwood'
          ? 'Rockwood'
          : factory === 'nguni'
            ? 'Nguni'
            : 'Document Library'
      )}
    </h1>

    <p className="mt-1 text-sm text-muted-foreground">
      Manage your quality procedures, forms, registers and other documents.
    </p>
  </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>

          <input
  ref={fileInputRef}
  type="file"
  multiple
  className="hidden"
  onChange={event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    uploadDocuments(files);
  }}
/>
      </div>

    

      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={goToRoot}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home size={16} />
          Folders
        </button>

        {breadcrumbs.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <ChevronRight size={15} className="text-muted-foreground" />
            <button
              type="button"
              onClick={() => setCurrentFolderId(folder.id)}
              className={`hover:text-foreground ${
                index === breadcrumbs.length - 1
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {folder.folder_name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Search and upload */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search folders and documents..."
            className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
            {(factory === 'rockwood' || factory === 'nguni' || categoryParam) && (
  <button
    type="button"
    onClick={() => {
      setNewFolderFactory(
        factory === 'rockwood' || factory === 'nguni'
          ? factory
          : 'rockwood'
      );
      setShowAddFolder(true);
      setError('');
      setMessage('');
    }}
    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
  >
    <Plus size={17} />
    Add Folder
  </button>
)}

          {currentFolder && (
  <div className="flex items-center justify-between gap-4 mb-6">
    <div>
      <h2 className="text-xl font-bold text-foreground">
        {currentFolder.folder_name}
      </h2>
      <p className="text-sm text-muted-foreground">
        Documents in this folder
      </p>
    </div>

    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      <Upload size={16} />
      {uploading ? 'Uploading...' : 'Upload Document'}
    </button>

    
<button
  type="button"
  onClick={() => {
    setNewFolderName('');

    const inheritedFactory =
      currentFolder?.factory?.toLowerCase();

    setNewFolderFactory(
      inheritedFactory === 'nguni' ||
      inheritedFactory === 'rockwood' ||
      inheritedFactory === 'both' ||
      inheritedFactory === 'general'
        ? inheritedFactory
        : factory === 'all' ? 'both' : factory
    );

    setError('');
    setMessage('');
    setShowAddFolder(true);
  }}
  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
>
  <FolderPlus size={16} />
  Add Subfolder
</button>

  </div>
)}
          {!currentFolder && (
            <span className="text-xs text-muted-foreground">
              Open a folder to upload documents.
            </span>
          )}
        </div>
      </div>

{/* Edit Folder Modal */}
{editingFolder && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">

      <div className="mb-5">
        <h3 className="text-xl font-bold text-foreground">
          Edit Folder
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Change the name of this folder.
        </p>
      </div>

      <form onSubmit={updateFolder} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Folder Name
          </label>

          <input
            type="text"
            value={editedFolderName}
            onChange={event => setEditedFolderName(event.target.value)}
            placeholder="Enter folder name"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            required
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setEditingFolder(null);
              setEditedFolderName('');
            }}
            disabled={savingFolder}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={savingFolder || !editedFolderName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {savingFolder ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Pencil size={16} />
            )}

            {savingFolder ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{/* Drag and Drop Upload Area */}



{showAddFolder && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
      <div className="mb-5">
        <h3 className="text-xl font-bold text-foreground">
          Create New Folder
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          {currentFolder
            ? `Create a subfolder inside "${currentFolder.folder_name}".`
            : `Create a folder inside "${categoryParam}".`}
        </p>
      </div>

      <form onSubmit={createFolder} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Folder Name
          </label>

          <input
            type="text"
            value={newFolderName}
            onChange={event => setNewFolderName(event.target.value)}
            placeholder="Enter folder name"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setShowAddFolder(false);
              setNewFolderName('');
              setError('');
            }}
            disabled={creatingFolder}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={creatingFolder}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creatingFolder ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}

            {creatingFolder ? 'Creating...' : 'Create Folder'}
          </button>
        </div>
            </form>
    </div>
  </div>
)}
{/* Drag and Drop Upload Area */}
{currentFolder && (
  <button
    type="button"
    disabled={uploading}
    onClick={() => fileInputRef.current?.click()}
    onDragOver={event => {
      event.preventDefault();
      if (!uploading) setIsDragging(true);
    }}
    onDragLeave={event => {
      event.preventDefault();
      setIsDragging(false);
    }}
    onDrop={event => {
      event.preventDefault();
      setIsDragging(false);

      if (uploading) return;

      const files = Array.from(event.dataTransfer.files);

      if (files.length > 0) {
        uploadDocuments(files);
      }
    }}
    className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
      isDragging
        ? 'border-primary bg-primary/10'
        : 'border-border bg-card hover:border-primary hover:bg-muted/50'
    } disabled:cursor-not-allowed disabled:opacity-50`}
  >
    {uploading ? (
      <Loader2
        size={36}
        className="mb-3 animate-spin text-primary"
      />
    ) : (
      <Upload
        size={36}
        className={`mb-3 ${
          isDragging ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
    )}

    <p className="font-semibold text-foreground">
      {uploading
        ? 'Uploading documents...'
        : isDragging
          ? 'Drop your files here!'
          : 'Drag and drop your documents here'}
    </p>

    <p className="mt-2 text-sm text-muted-foreground">
      {uploading
        ? 'Please wait while your files are uploaded.'
        : 'Or click here to browse and select files.'}
    </p>

    <p className="mt-3 text-xs text-muted-foreground">
      Multiple files supported · Maximum 50 MB per file
    </p>
  </button>
)}

      {/* Feedback */}
      {error && (
        <div className="whitespace-pre-wrap rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* Current location */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {currentFolder ? currentFolder.folder_name : 'Document Folders'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedFactoryLabel}
              {currentFolder?.factory
                ? ` · ${currentFolder.factory}`
                : ''}
            </p>
          </div>

          {currentFolder && (
            <button
              type="button"
              onClick={() => {
                const parent = folders.find(
                  folder => folder.id === currentFolder.parent_folder_id
                );
                setCurrentFolderId(parent?.id || null);
                setSearch('');
              }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border p-12 text-sm text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            Loading folders and documents...
          </div>
        ) : (
          <>
            
{/* Folders */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
  {visibleFolders.map(folder => (
    <div
      key={folder.id}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary"
    >
      <button
        type="button"
        onClick={() => openFolder(folder)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <Folder size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {folder.folder_name}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {folder.factory || 'No factory assigned'}
          </p>
        </div>

        <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
      </button>

      <div className="flex justify-end border-t pt-3">
         {/* Edit Folder */}
  <button
    type="button"
    onClick={() => {
      setEditingFolder(folder);
      setEditedFolderName(folder.folder_name);
      setError('');
      setMessage('');
    }}
    title="Edit folder name"
    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
  >
    <Pencil size={16} />
  </button>
        <button
          type="button"
          onClick={() => deleteFolder(folder)}
          disabled={deletingFolderId === folder.id}
          title="Delete folder and all its contents"
          className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deletingFolderId === folder.id ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    </div>
  ))}
</div>


            {/* Documents */}
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} />
                  <h4 className="font-semibold">Documents</h4>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {visibleDocuments.length}
                  </span>
                </div>
              </div>

              {visibleDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 rounded-full bg-muted p-4">
                    {currentFolder ? (
                      <FolderOpen size={28} className="text-muted-foreground" />
                    ) : (
                      <FilePlus size={28} className="text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-medium text-foreground">
                    No documents found
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {currentFolder
                      ? 'Upload a document into this folder to get started.'
                      : 'Open a folder to view its documents.'}
                  </p>
                </div>
              ) : (
                
             
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
  {visibleDocuments.map(document => (
    <div
      key={document.id}
      className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-muted p-3">
            <File size={24} className="text-muted-foreground" />
          </div>

          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-foreground">
              {document.title || document.original_file_name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {document.document_type || 'Document'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => downloadDocument(document)}
            disabled={!document.file_path}
            title="Download document"
           className="rounded-full p-2 text-muted-foreground bg-red-100 hover:text-red-600 disabled:opacity-40"
          >
            <Download size={17} />
          </button>

          <button
            type="button"
            onClick={() => deleteDocument(document)}
            disabled={deletingId === document.id}
            title="Delete document"
            className="rounded-full p-2 text-muted-foreground bg-red-100 hover:text-red-600 disabled:opacity-40"
          >
            {deletingId === document.id ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Trash2 size={17} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Document number</span>
          <span className="font-medium text-foreground">
            {document.document_no || 'Not assigned'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">File size</span>
          <span className="text-foreground">
            {formatSize(document.file_size)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Uploaded</span>
          <span className="text-foreground">
            {formatDate(document.uploaded_at || document.created_at)}
          </span>
        </div>
         </div>
    </div>
  ))}
</div>
)}


            {visibleFolders.length === 0 &&
              visibleDocuments.length === 0 &&
              !search.trim() && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Nothing else to display in this location.
                </p>
              )}
        </div>
          </>
          
        )}
      </div>
  
    </div>
  );
};

export default QualityDocuments;
