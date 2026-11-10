
import React, { useEffect, useState } from 'react';

import {
  Download,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  Loader2,
  BookOpen,
  Tags,
  X,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { toast } from 'sonner';

interface BDMResource {
  id: string;
  title: string;
  file_name: string | null;
  file_path: string | null;
  status: string;
  created_at: string;
}

type TabType = 'price_list' | 'product';

const BDMRetailPricing: React.FC = () => {
  const { fmsUser } = useFMSAuth();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('price_list');

  // Documents
  const [resources, setResources] = useState<BDMResource[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState('');

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Replacement
  const [editingItem, setEditingItem] = useState<BDMResource | null>(null);

  const canManage =
    fmsUser?.role === 'system_admin' ||
    fmsUser?.role === 'bdm_user';

  const isMenu = activeTab === 'price_list';

  const pageTitle = isMenu
    ? 'Retail & Menu'
    : 'Product Catalogue';

  const documentName = isMenu
    ? 'Retail Price List'
    : 'Product Catalogue';

  // Load documents for the selected tab
  useEffect(() => {
    loadResources();
  }, [activeTab, canManage]);

  const loadResources = async () => {
    setLoading(true);

    let query = supabase
      .from('fms_bdm_resources')
      .select(
        'id, title, file_name, file_path, status, created_at'
      )
      .eq('resource_type', activeTab)
      .order('created_at', { ascending: false });

    // Retail users only see approved documents
    if (!canManage) {
      query = query.eq('status', 'approved');
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      toast.error('Could not load documents.');
      setResources([]);
    } else {
      setResources(data || []);
    }

    setLoading(false);
  };

  // Open upload modal
  const openUpload = (item?: BDMResource) => {
    setEditingItem(item || null);
    setTitle(item?.title || '');
    setSelectedFile(null);
    setShowUpload(true);
  };

  // Close upload modal
  const closeUpload = () => {
    if (uploading) return;

    setShowUpload(false);
    setEditingItem(null);
    setTitle('');
    setSelectedFile(null);
  };

  // Upload or replace PDF
  const handleUpload = async () => {
    if (!title.trim()) {
      toast.error('Please enter a document name.');
      return;
    }

    if (!selectedFile) {
      toast.error('Please select a PDF file.');
      return;
    }

    const isPDF =
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf');

    if (!isPDF) {
      toast.error('Only PDF files are allowed.');
      return;
    }

    // Existing bucket limit: 50 MB
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('The PDF cannot exceed 50 MB.');
      return;
    }

    setUploading(true);

    const oldFilePath = editingItem?.file_path;

    const safeFileName = selectedFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const filePath =
      `${activeTab}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}-${safeFileName}`;

    try {
      // Upload PDF to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('bdm-resources')
        .upload(filePath, selectedFile, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        toast.error('PDF upload failed.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let saveError;

      if (editingItem) {
        // Replace existing document
        const { error } = await supabase
          .from('fms_bdm_resources')
          .update({
            title: title.trim(),
            file_name: selectedFile.name,
            file_path: filePath,
            file_type: 'application/pdf',
            file_size: selectedFile.size,
            status: 'approved',
            uploaded_by: user?.id,
          })
          .eq('id', editingItem.id);

        saveError = error;
      } else {
        // Create new document
        const { error } = await supabase
          .from('fms_bdm_resources')
          .insert({
            resource_type: activeTab,
            title: title.trim(),
            file_name: selectedFile.name,
            file_path: filePath,
            file_type: 'application/pdf',
            file_size: selectedFile.size,
            status: 'approved',
            uploaded_by: user?.id,
          });

        saveError = error;
      }

      if (saveError) {
        console.error(saveError);

        // Remove newly uploaded file if database save fails
        await supabase.storage
          .from('bdm-resources')
          .remove([filePath]);

        toast.error('Could not save the document.');
        return;
      }

      // Remove old PDF after successful replacement
      if (editingItem && oldFilePath) {
        const { error: removeError } = await supabase.storage
          .from('bdm-resources')
          .remove([oldFilePath]);

        if (removeError) {
          console.error(removeError);
          toast.warning(
            'Document replaced, but the previous PDF could not be removed.'
          );
        }
      }

      toast.success(
        editingItem
          ? 'Document replaced successfully.'
          : 'Document uploaded and approved successfully.'
      );

      closeUpload();
      await loadResources();

    } catch (error) {
      console.error(error);
      toast.error('Something went wrong during upload.');
    } finally {
      setUploading(false);
    }
  };

  // Download PDF
  const handleDownload = async (item: BDMResource) => {
    if (!item.file_path) {
      toast.error('No PDF is available.');
      return;
    }

    setDownloadingId(item.id);

    try {
      const { data, error } = await supabase.storage
        .from('bdm-resources')
        .createSignedUrl(item.file_path, 60);

      if (error || !data?.signedUrl) {
        toast.error('Could not download the PDF.');
        return;
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      );

    } catch (error) {
      console.error(error);
      toast.error('Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete document
  const handleDelete = async (item: BDMResource) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.title}"?`
    );

    if (!confirmed) return;

    setDeletingId(item.id);

    try {
      const { error } = await supabase
        .from('fms_bdm_resources')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error(error);
        toast.error('Could not delete the document.');
        return;
      }

      if (item.file_path) {
        const { error: storageError } = await supabase.storage
          .from('bdm-resources')
          .remove([item.file_path]);

        if (storageError) {
          console.error(storageError);
          toast.warning(
            'Document deleted, but its stored PDF could not be removed.'
          );
        }
      }

      toast.success('Document deleted successfully.');
      await loadResources();

    } catch (error) {
      console.error(error);
      toast.error('Something went wrong.');
    } finally {
      setDeletingId(null);
    }
  };

  // Search documents
  const filteredResources = resources.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.file_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">

      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Retail & Product Catalogue
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Access the latest approved documents to share with customers.
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-2 border-b">
        <button
          onClick={() => {
            setActiveTab('price_list');
            setSearch('');
            closeUpload();
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            isMenu
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Tags size={17} />
          Menu
        </button>

        <button
          onClick={() => {
            setActiveTab('product');
            setSearch('');
            closeUpload();
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            !isMenu
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen size={17} />
          Product Catalogue
        </button>
      </div>

      {/* DOCUMENT HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {pageTitle}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {isMenu
              ? 'Retail pricing documents available for customers.'
              : 'Company product catalogue documents available for customers.'}
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => openUpload()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            <Plus size={17} />
            Upload PDF
          </button>
        )}
      </div>

      {/* UPLOAD / REPLACE MODAL */}
      {showUpload && canManage && (
        <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                {editingItem ? 'Replace Document' : 'Upload New Document'}
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                {editingItem
                  ? 'Upload a new PDF to replace the existing document.'
                  : `Upload the complete ${documentName.toLowerCase()} PDF.`}
              </p>
            </div>

            <button
              onClick={closeUpload}
              disabled={uploading}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X size={18} />
            </button>
          </div>

          {/* DOCUMENT NAME */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Document Name
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isMenu
                  ? 'e.g. Delish Retail Price List'
                  : 'e.g. Maharaja Product Catalogue'
              }
              disabled={uploading}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* PDF FILE */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Select PDF
            </label>

            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={uploading}
              onChange={(e) =>
                setSelectedFile(e.target.files?.[0] || null)
              }
              className="w-full rounded-lg border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
            />

            <p className="mt-1.5 text-xs text-muted-foreground">
              PDF files only. Maximum file size: 50 MB.
            </p>

            {selectedFile && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <FileText size={20} className="text-primary" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {selectedFile.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <CheckCircle2 size={18} className="text-green-600" />
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeUpload}
              disabled={uploading}
              className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading || !title.trim() || !selectedFile}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Uploading PDF...
                </>
              ) : editingItem ? (
                <>
                  <RefreshCw size={17} />
                  Replace PDF
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload & Approve
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3">
        <Search size={18} className="text-muted-foreground" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${documentName.toLowerCase()}...`}
          className="w-full bg-transparent py-3 text-sm outline-none"
        />

        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* DOCUMENT TABLE */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-5 py-3 font-semibold">
                  Document Name
                </th>

                <th className="px-5 py-3 font-semibold">
                  File
                </th>

                <th className="px-5 py-3 font-semibold">
                  Date Added
                </th>

                <th className="px-5 py-3 font-semibold">
                  Status
                </th>

                <th className="px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">

              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto mb-2 animate-spin" size={25} />
                    Loading documents...
                  </td>
                </tr>

              ) : filteredResources.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    <FileText
                      size={35}
                      className="mx-auto mb-3 opacity-40"
                    />

                    <p className="font-medium">
                      No documents found.
                    </p>

                    <p className="mt-1 text-xs">
                      {canManage
                        ? 'Upload a PDF to get started.'
                        : 'There are currently no approved documents available.'}
                    </p>
                  </td>
                </tr>

              ) : (
                filteredResources.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-muted/30"
                  >

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText
                            size={20}
                            className="text-primary"
                          />
                        </div>

                        <span className="font-medium">
                          {item.title}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <FileText size={15} />
                        <span className="max-w-[180px] truncate">
                          {item.file_name || 'PDF Document'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('en-ZA')}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        <CheckCircle2 size={13} />
                        {item.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">

                        {/* DOWNLOAD */}
                        <button
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item.id}
                          className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Download size={17} />
                          )}
                        </button>

                        {canManage && (
                          <>
                            {/* REPLACE */}
                            <button
                              onClick={() => openUpload(item)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                              title="Replace PDF"
                            >
                              <RefreshCw size={17} />
                            </button>

                            {/* DELETE */}
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                              title="Delete document"
                            >
                              {deletingId === item.id ? (
                                <Loader2 size={17} className="animate-spin" />
                              ) : (
                                <Trash2 size={17} />
                              )}
                            </button>
                          </>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT COUNT */}
      {!loading && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredResources.length} document(s)
          </span>

          <span>
            {isMenu ? 'Retail Price Lists' : 'Product Catalogue'}
          </span>
        </div>
      )}

    </div>
  );
};

export default BDMRetailPricing;
