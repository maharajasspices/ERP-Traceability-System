
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFMSAuth } from "@/context/FMSAuthContext";
import { toast } from "sonner";

import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  Home,
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type FactoryDocumentLibraryProps = {
  factory: "rockwood" | "nguni";
};

type QualityFolder = {
  id: string;
  folder_name: string;
  factory: "rockwood" | "nguni";
  parent_folder_id: string | null;
  created_at: string;
};

type UploadedDocument = {
  id: string;
  document_name: string;
  document_number: string | null;
  category: string;
  subcategory: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  factory: "rockwood" | "nguni";
  folder_id: string;
  created_at: string;
};

const FactoryDocumentLibrary: React.FC<FactoryDocumentLibraryProps> = ({
  factory,
}) => {
  const { fmsUser } = useFMSAuth();

  const isAdmin = fmsUser?.role === "system_admin";

  const factoryName =
    factory === "rockwood" ? "Rockwood Factory" : "Nguni Factory";

  const [folders, setFolders] = useState<QualityFolder[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null
  );

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load folders belonging to this factory
  const loadFolders = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_folders")
        .select("*")
        .eq("factory", factory)
        .order("folder_name", { ascending: true });

      if (error) throw error;

      setFolders(data || []);
    } catch (error: any) {
      console.error("Error loading factory folders:", error);
      toast.error("Could not load factory folders.");
    } finally {
      setLoading(false);
    }
  };

  // Load documents inside the currently opened folder
  const loadDocuments = async () => {
    if (!currentFolderId) {
      setDocuments([]);
      return;
    }

    setDocumentsLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_uploaded_documents")
        .select("*")
        .eq("factory", factory)
        .eq("folder_id", currentFolderId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error loading folder documents:", error);
      toast.error("Could not load documents.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentFolderId(null);
    loadFolders();
  }, [factory]);

  useEffect(() => {
    loadDocuments();
  }, [factory, currentFolderId]);

  // Find the folder currently being viewed
  const currentFolder = folders.find(
    (folder) => folder.id === currentFolderId
  );

  // Only show folders inside the current folder
  const visibleFolders = useMemo(() => {
    return folders.filter((folder) => {
      const isInsideCurrentFolder =
        folder.parent_folder_id === currentFolderId;

      const matchesSearch = folder.folder_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim());

      return isInsideCurrentFolder && matchesSearch;
    });
  }, [folders, currentFolderId, searchTerm]);

  // Create a folder or subfolder
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name.");
      return;
    }

    setCreatingFolder(true);

    try {
      const { error } = await (supabase as any)
        .from("fms_quality_folders")
        .insert({
          folder_name: folderName.trim(),
          factory,
          parent_folder_id: currentFolderId,
        });

      if (error) throw error;

      toast.success("Folder created successfully!");
      setFolderName("");
      await loadFolders();
    } catch (error: any) {
      console.error("Error creating folder:", error);
      toast.error(error.message || "Could not create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Upload documents into the currently opened folder
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!currentFolderId || !currentFolder) {
      toast.error("Please open a folder before uploading.");
      return;
    }

    setUploading(true);

    let uploadedCount = 0;
    let failedCount = 0;

    try {
      const selectedFiles = Array.from(files);

      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];

        const safeFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const filePath = `${factory}/${currentFolderId}/${Date.now()}-${index}-${safeFileName}`;

        try {
          // Upload the actual file to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("quality-documents")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });

          if (uploadError) throw uploadError;

          // Save the document information in Supabase
          const { error: insertError } = await (supabase as any)
            .from("fms_quality_uploaded_documents")
            .insert({
              document_name: file.name,
              document_number: null,
              category: "Controlled Documents",
              subcategory:
                factory === "rockwood"
                  ? "Standard Operating Procedures – Rockwood"
                  : "Standard Operating Procedures – Nguni",
              file_path: filePath,
              file_type: file.type || "application/octet-stream",
              file_size: file.size,
              description: null,
              factory,
              folder_id: currentFolderId,
            });

          if (insertError) {
            // Remove the uploaded file if its metadata could not be saved
            await supabase.storage
              .from("quality-documents")
              .remove([filePath]);

            throw insertError;
          }

          uploadedCount++;
        } catch (fileError: any) {
          console.error(`Upload failed for ${file.name}:`, fileError);
          failedCount++;
        }
      }

      if (uploadedCount > 0) {
        toast.success(
          `${uploadedCount} document${uploadedCount === 1 ? "" : "s"} uploaded successfully!`
        );
      }

      if (failedCount > 0) {
        toast.error(`${failedCount} document upload(s) failed.`);
      }

      await loadDocuments();
    } catch (error: any) {
      console.error("Document upload error:", error);
      toast.error(error.message || "Could not upload documents.");
    } finally {
      setUploading(false);
    }
  };

  // View a document
  const handleViewDocument = async (document: UploadedDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("quality-documents")
        .createSignedUrl(document.file_path, 300);

      if (error) throw error;

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Error opening document:", error);
      toast.error(error.message || "Could not open document.");
    }
  };

  // Download a document
  const handleDownloadDocument = async (document: UploadedDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("quality-documents")
        .download(document.file_path);

      if (error) throw error;

      const downloadUrl = URL.createObjectURL(data);
      const link = window.document.createElement("a");

      link.href = downloadUrl;
      link.download = document.document_name;
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error("Error downloading document:", error);
      toast.error(error.message || "Could not download document.");
    }
  };

  // Delete a document (administrators only)
  const handleDeleteDocument = async (document: UploadedDocument) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${document.document_name}"?`
    );

    if (!confirmed) return;

    setDeletingDocumentId(document.id);

    try {
      const { error: storageError } = await supabase.storage
        .from("quality-documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      const { error: databaseError } = await (supabase as any)
        .from("fms_quality_uploaded_documents")
        .delete()
        .eq("id", document.id);

      if (databaseError) throw databaseError;

      toast.success("Document deleted successfully!");
      await loadDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error(error.message || "Could not delete document.");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  // Build the breadcrumb path for the current folder
  const breadcrumbFolders = useMemo(() => {
    const path: QualityFolder[] = [];
    let folder = currentFolder;

    while (folder) {
      path.unshift(folder);

      folder = folder.parent_folder_id
        ? folders.find((item) => item.id === folder?.parent_folder_id)
        : undefined;
    }

    return path;
  }, [folders, currentFolder]);

  // Format file sizes
  const formatFileSize = (size: number | null) => {
    if (!size) return "Unknown size";

    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {factoryName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Standard Operating Procedures and Factory Documents
            </p>
          </div>
        </div>

        <Badge variant="secondary">
          {folders.length} Folders
        </Badge>
      </div>

      {/* Breadcrumb navigation */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => setCurrentFolderId(null)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {factoryName}
        </button>

        {breadcrumbFolders.map((folder) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />

            <button
              onClick={() => setCurrentFolderId(folder.id)}
              className={
                folder.id === currentFolderId
                  ? "font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {folder.folder_name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Folder management */}
      {isAdmin && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FolderPlus className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h3 className="font-semibold">
                  {currentFolderId ? "Create Subfolder" : "Create Folder"}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {currentFolderId
                    ? `Create a folder inside ${currentFolder?.folder_name || "this folder"}.`
                    : `Create a new folder in ${factoryName}.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Enter folder name"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCreateFolder();
                }}
              />

              <Button
                onClick={handleCreateFolder}
                disabled={creatingFolder}
                className="shrink-0"
              >
                {creatingFolder ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create Folder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search folders */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          placeholder="Search folders..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="pl-10"
        />
      </div>

      {/* Back button */}
      {currentFolderId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCurrentFolderId(currentFolder?.parent_folder_id || null);
            setSearchTerm("");
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Parent Folder
        </Button>
      )}

      {/* Upload documents - only inside an opened folder */}
      {currentFolderId && isAdmin && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Upload className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h3 className="font-semibold">Upload Documents</h3>
                <p className="text-sm text-muted-foreground">
                  Upload files into {currentFolder?.folder_name}.
                </p>
              </div>
            </div>

            <Input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const selectedFiles = event.target.files;
                event.target.value = "";
                void handleUpload(selectedFiles);
              }}
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Select Files to Upload"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Folder list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading folders...
        </div>
      ) : visibleFolders.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFolders.map((folder) => (
            <Card
              key={folder.id}
              className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => {
                setCurrentFolderId(folder.id);
                setSearchTerm("");
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <FolderOpen className="h-7 w-7 text-amber-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold group-hover:text-primary">
                    {folder.folder_name}
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    Folder
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !currentFolderId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Folder className="h-10 w-10 text-muted-foreground" />

              <h3 className="mt-3 font-semibold">No folders found</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm
                  ? "Try another search term."
                  : isAdmin
                    ? "Create your first folder to get started."
                    : "There are currently no folders in this location."}
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* Documents inside the opened folder */}
      {currentFolderId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Documents</h2>
              <p className="text-sm text-muted-foreground">
                Files saved in this folder
              </p>
            </div>

            <Badge variant="secondary">
              {documents.length} Documents
            </Badge>
          </div>

          {documentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />

                <h3 className="mt-3 font-semibold">
                  No documents uploaded yet
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  {isAdmin
                    ? "Use the Upload Documents button above to add files."
                    : "There are currently no documents in this folder."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <Card key={document.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-medium">
                        {document.document_name}
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>•</span>
                        <span>
                          {new Date(document.created_at).toLocaleDateString()}
                        </span>
                        {document.file_type && (
                          <>
                            <span>•</span>
                            <span>{document.file_type}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocument(document)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadDocument(document)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>

                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingDocumentId === document.id}
                          onClick={() => handleDeleteDocument(document)}
                        >
                          {deletingDocumentId === document.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FactoryDocumentLibrary;
