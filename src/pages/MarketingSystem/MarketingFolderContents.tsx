
import React, { useEffect,useRef, useState } from 'react';
import * as tus from 'tus-js-client'
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Folder, Upload, FileText, Download } from 'lucide-react';

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
        const { error } = await supabase
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

  const loadContents = async () => {
    if (!id) return;

    setLoading(true);

    const { data: folderData, error: folderError } = await supabase
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

    const { data: itemData, error: itemError } = await supabase
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

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}
        </Button>

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
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 p-3">
  {item.item_type === 'folder' ? (
    <Folder className="h-5 w-5 text-amber-600" />
  ) : (
    <FileText className="h-5 w-5 text-primary" />
  )}

  <span className="min-w-0 flex-1 truncate text-sm font-medium">
    {item.name}
  </span>

  {item.item_type === 'file' && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => downloadFile(item)}
    >
      <Download className="mr-2 h-4 w-4" />
      Download
    </Button>
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