
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
  document_mode: "normal" | "fillable_form";
  digital_template: Record<string, any>;
  created_at: string;
  quality_document_id: string | null;
};


type DigitalFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "radio"
  | "signature";

type DigitalFormField = {
  id: string;
  name: string;
  label: string;
  type: DigitalFormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  width: "full" | "half" | "third";
};

type DigitalFormSection = {
  id: string;
  title: string;
  description?: string;
  columns: 1 | 2 | 3;
  fields: DigitalFormField[];
};

type DigitalRegisterColumn = {
  id: string;
  fieldName: string;
  label: string;
  visible: boolean;
  source: 'form' | 'system';
};

type DigitalFormTemplate = {
  templateKey: string;
  version: number;
  title: string;
  documentNumber: string;
  sections: DigitalFormSection[];
  registerColumns: DigitalRegisterColumn[];
};


const defaultNCRTemplate: DigitalFormTemplate = {
  templateKey: "ncr-report",
  version: 1,
  title: "Non-Conformance Report Form",
  documentNumber: "MS Q002 FORM 1",
  sections: [
    {
      id: "section-1",
      title: "SECTION 1: Reporting Party",
      description: "To be completed by Reporting Party",
      columns: 2,
      fields: [
        { id: "originator", name: "originatorName", label: "Originator Name", type: "text", required: true, width: "half" },
        { id: "product", name: "productDescription", label: "Product Description", type: "text", required: true, width: "half" },
        { id: "supplier", name: "contractorSupplier", label: "Contractor/Supplier", type: "text", required: false, width: "half" },
        { id: "batch", name: "batchNumber", label: "Batch Number", type: "text", required: false, width: "half" },
        { id: "quantity", name: "quantity", label: "Qty", type: "number", required: false, width: "half" },
        { id: "ncr", name: "ncrNumber", label: "NCR Number", type: "text", required: true, width: "half" },
        { id: "activity", name: "foundDuring", label: "Found During What Activity", type: "select", required: true, options: ["Incoming Inspection", "In-process Inspection", "Final Inspection", "Other"], width: "full" },
        { id: "problem", name: "problemDescription", label: "Problem Description", type: "textarea", required: true, width: "full" },
        { id: "immediate", name: "immediateAction", label: "Immediate Action Taken", type: "textarea", required: false, width: "full" },
        { id: "occurrence", name: "dateOfOccurrence", label: "Date of Occurrence", type: "date", required: true, width: "half" },
        { id: "signature", name: "reportingSignature", label: "Signature", type: "signature", required: true, width: "half" },
        { id: "reportDate", name: "reportDate", label: "Date", type: "date", required: true, width: "half" },
      ],
    },
    {
      id: "section-2",
      title: "SECTION 2: Production Manager",
      description: "To be completed by Production Manager",
      columns: 2,
      fields: [
        { id: "criticality", name: "criticalityLevel", label: "Criticality Level", type: "select", required: true, options: ["High", "Medium/Moderate", "Low"], width: "full" },
        { id: "retesting", name: "retestingResult", label: "Retesting of Product Result", type: "textarea", required: false, width: "full" },
        { id: "disposition", name: "disposition", label: "Disposition", type: "select", required: true, options: ["Use-as-is", "Rework", "Return to supplier", "Repair", "Reject", "Other"], width: "full" },
        { id: "requiredAction", name: "requiredAction", label: "Required Action", type: "textarea", required: true, width: "full" },
        { id: "owner", name: "owner", label: "Owner", type: "text", required: true, width: "third" },
        { id: "assignedDate", name: "dateAssigned", label: "Date Assigned", type: "date", required: true, width: "third" },
        { id: "dueDate", name: "investigationDueDate", label: "Investigation Due Date", type: "date", required: true, width: "third" },
      ],
    },
    {
      id: "section-3",
      title: "SECTION 3: Corrective and Preventative Action",
      description: "To be completed by Owner and returned to Production Manager for review prior to due date",
      columns: 2,
      fields: [
        { id: "capaApproval", name: "capaApproval", label: "Approval of Corrective/Preventative Action", type: "select", required: true, options: ["Yes", "No"], width: "full" },
        { id: "capaNumber", name: "capaRcaFormNumber", label: "CAPA & RCA Form No. Issued", type: "text", required: false, width: "full" },
        { id: "ownerName", name: "ownerName", label: "Name", type: "text", required: true, width: "third" },
        { id: "ownerDate", name: "ownerDate", label: "Date", type: "date", required: true, width: "third" },
        { id: "ownerSignature", name: "ownerSignature", label: "Signature", type: "signature", required: true, width: "third" },
      ],
    },
    {
      id: "section-4",
      title: "SECTION 4: Closing the Non-Conformance",
      description: "To be completed by Quality Designee or Other (Specify)",
      columns: 2,
      fields: [
        { id: "correctiveCompleted", name: "correctiveActionCompleted", label: "Planned Disposition completed and Corrective Action initiated", type: "select", required: true, options: ["Yes", "No"], width: "full" },
        { id: "newNcr", name: "newNcrNumber", label: "New NCR Number (if No)", type: "text", required: false, width: "half" },
        { id: "qualitySignature", name: "qualityDesigneeSignature", label: "Quality Designee Signature", type: "signature", required: true, width: "half" },
        { id: "closingDate", name: "closingDate", label: "Date", type: "date", required: true, width: "half" },
      ],
    },
  ],
  registerColumns: [
  { id: "reg-ncr", fieldName: "ncrNumber", label: "NCR Number", visible: true, source: "form" },
  { id: "reg-date", fieldName: "dateOfOccurrence", label: "Date Reported", visible: true, source: "form" },
  { id: "reg-product", fieldName: "productDescription", label: "Product", visible: true, source: "form" },
  { id: "reg-batch", fieldName: "batchNumber", label: "Batch Number", visible: true, source: "form" },
  { id: "reg-criticality", fieldName: "criticalityLevel", label: "Criticality", visible: true, source: "form" },
  { id: "reg-owner", fieldName: "owner", label: "Owner", visible: true, source: "form" },
  { id: "reg-disposition", fieldName: "disposition", label: "Disposition", visible: true, source: "form" },
  { id: "reg-status", fieldName: "status", label: "Status", visible: true, source: "system" },
],
};


const FactoryDocumentLibrary: React.FC<FactoryDocumentLibraryProps> = ({
  factory,
  
}) => {
  
  const { fmsUser } = useFMSAuth();

  const saveDigitalTemplate = async (
  template: DigitalFormTemplate
) => {
  if (!isAdmin) {
    toast.error("Only system administrators can edit master forms.");
    return null;
  }

  try {
    const { data: existingTemplate, error: findError } = await (supabase as any)
      .from("fms_quality_uploaded_documents")
      .select("id, digital_template")
      .eq("document_number", template.documentNumber)
      .eq("document_mode", "fillable_form")
      .eq("factory", "rockwood")
      .maybeSingle();

    if (findError) throw findError;

    const nextTemplate = {
      ...template,
      version: existingTemplate?.digital_template?.version
        ? existingTemplate.digital_template.version + 1
        : 1,
    };

    if (existingTemplate) {
      const { error } = await ( supabase as any)
        .from("fms_quality_uploaded_documents")
        .update({
          document_name: nextTemplate.title,
          digital_template: nextTemplate,
          description: "Shared digital NCR master form",
        })
        .eq("id", existingTemplate.id);

      if (error) throw error;
    } else {
      const { error } = await (supabase as any)
        .from("fms_quality_uploaded_documents")
        .insert({
          document_name: nextTemplate.title,
          document_number: nextTemplate.documentNumber,
          category: "Quality Forms",
          subcategory: "Non-Conformance",
          file_path: "digital-templates/ncr-report",
          file_type: "digital",
          description: "Shared digital NCR master form",
          factory: "rockwood",
          folder_id: null,
          document_mode: "fillable_form",
          digital_template: nextTemplate,
        });

      if (error) throw error;
    }

    toast.success("NCR master template saved successfully.");
    return nextTemplate;
  } catch (error) {
    console.error("Error saving NCR template:", error);
    toast.error("Could not save the NCR master template.");
    return null;
  }
};


const loadNCRRecords = async () => {
  setLoadingNCRRecords(true);

  try {
    const { data, error } = await (supabase as any)
      .from("fms_quality_records")
      .select("*")
      .eq("factory", factory)
      .eq("uploaded_document_id", selectedDigitalDocument?.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setNcrRecords(data || []);
  } catch (error: any) {
    console.error("Error loading NCR records:", error);
    toast.error("Could not load the NCR Master Sheet.");
  } finally {
    setLoadingNCRRecords(false);
  }
};

const handleOpenMasterSheet = async () => {
  setShowMasterSheet(true);
  await loadNCRRecords();
};



const loadDigitalTemplate = async (): Promise<DigitalFormTemplate> => {
  try {
    const { data, error } = await (supabase as any)
      .from("fms_quality_uploaded_documents")
      .select("digital_template")
      .eq("document_number", defaultNCRTemplate.documentNumber)
      .eq("document_mode", "fillable_form")
      .eq("factory", "rockwood")
      .maybeSingle();

    if (error) throw error;

    if (
      data?.digital_template &&
      (data.digital_template as any).templateKey === "ncr-report"
    ) {
      return data.digital_template as DigitalFormTemplate;
    }

    return defaultNCRTemplate;
  } catch (error) {
    console.error("Error loading NCR template:", error);
    toast.error("Could not load the saved NCR template.");
    return defaultNCRTemplate;
  }
};


  const isAdmin = fmsUser?.role === "system_admin";

  const factoryName =
    factory === "rockwood" ? "Rockwood Factory" : "Nguni Factory";

  const [folders, setFolders] = useState<QualityFolder[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const [digitalTemplate, setDigitalTemplate] =
  useState<DigitalFormTemplate>(defaultNCRTemplate);
  const [loadingDigitalTemplate, setLoadingDigitalTemplate] =
  useState(false);

  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [savingNCR, setSavingNCR] = useState(false);

  const [selectedDigitalDocument, setSelectedDigitalDocument] =
  useState<UploadedDocument | null>(null);

  const [ncrRecords, setNcrRecords] = useState<any[]>([]);
const [loadingNCRRecords, setLoadingNCRRecords] = useState(false);
const [showMasterSheet, setShowMasterSheet] = useState(false);

 const [ncrFormValues, setNcrFormValues] = useState<Record<string, any>>({});

  const [uploadMode, setUploadMode] = useState<
  "normal" | "fillable_form"
>("normal");

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

  useEffect(() => {
  let isMounted = true;

  const fetchTemplate = async () => {
    setLoadingDigitalTemplate(true);

    const template = await loadDigitalTemplate();

    if (isMounted) {
      setDigitalTemplate(template);
      setLoadingDigitalTemplate(false);
    }
  };

  void fetchTemplate();

  return () => {
    isMounted = false;
  };
}, [factory]);
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
  const handleUpload = async (files: File[] | FileList | null) => {
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
              document_mode: uploadMode,
              digital_template: {},
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
    if (document.document_mode === "fillable_form") {
      const template = await loadDigitalTemplate();

      setDigitalTemplate(template);
      setSelectedDigitalDocument(document);

      return;
    }

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


const handleSaveNCR = async () => {
  if (!selectedDigitalDocument) return;

  const requiredFields = digitalTemplate.sections.flatMap((section) =>
    section.fields.filter((field) => field.required)
  );

  const missingFields = requiredFields.filter((field) => {
    const value = ncrFormValues[field.name];
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (missingFields.length > 0) {
    toast.error(
      `Please complete the required fields: ${missingFields
        .map((field) => field.label)
        .join(", ")}`
    );
    return;
  }

  setSavingNCR(true);

  try {
    const { error } = await (supabase as any)
      .from("fms_quality_records")
      .insert({
        document_id: null,
        uploaded_document_id: selectedDigitalDocument.id,
        record_number: ncrFormValues.ncrNumber || null,
        title: `Non-Conformance Report - ${
          ncrFormValues.ncrNumber || "New NCR"
        }`,
        form_data: {
          ...ncrFormValues,
          template_snapshot: digitalTemplate,
        },
        status: "submitted",
        created_by: (await supabase.auth.getUser()).data.user?.id,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
        submitted_at: new Date().toISOString(),
        factory,
      });

    if (error) throw error;

    toast.success("NCR submitted successfully!");

    setNcrFormValues({});
    setSelectedDigitalDocument(null);
  } catch (error: any) {
    console.error("NCR submission failed:", error);
    toast.error(error.message || "Could not save NCR.");
  } finally {
    setSavingNCR(false);
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
    if (document.document_mode === "fillable_form") {
  toast.error(
    "This is a master digital form and cannot be deleted because it may have saved records linked to it."
  );
  return;
}
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

        {/* Master Sheet */}
<div
  onClick={handleOpenMasterSheet}
  className="flex cursor-pointer items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30"
>
  <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900">
    <FileText className="h-6 w-6 text-green-700 dark:text-green-300" />
  </div>

  <div className="flex-1">
    <p className="font-semibold text-green-900 dark:text-green-100">
      Master Sheet
    </p>
    <p className="text-sm text-green-700 dark:text-green-300">
      NCR Register – {factoryName}
    </p>
  </div>

  <Badge className="bg-green-600 text-white">
    Register
  </Badge>
</div>
      </div>

      
{/* NCR MASTER SHEET */}
{showMasterSheet && (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Master Sheet</h2>
          <p className="text-sm text-muted-foreground">
            Non-Conformance Register – {factoryName}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowMasterSheet(false)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Folders
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingNCRRecords ? (
            <div className="flex items-center justify-center gap-2 p-10">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Master Sheet...
            </div>
          ) : ncrRecords.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No NCR records have been submitted for this factory yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {digitalTemplate.registerColumns
                      .filter(column => column.visible)
                      .map(column => (
                        <th
                          key={column.id}
                          className="whitespace-nowrap px-4 py-3 text-left font-semibold"
                        >
                          {column.label}
                        </th>
                      ))}
                  </tr>
                </thead>

                <tbody>
                  {ncrRecords.map(record => (
                    <tr
                      key={record.id}
                      className="border-t hover:bg-muted/50"
                    >
                      {digitalTemplate.registerColumns
                        .filter(column => column.visible)
                        .map(column => {
                          const value =
                            column.source === "system"
                              ? record[column.fieldName]
                              : record.form_data?.[column.fieldName];

                          return (
                            <td
                              key={column.id}
                              className="whitespace-nowrap px-4 py-3"
                            >
                              {column.fieldName === "created_at" ||
                              column.fieldName === "dateOfOccurrence"
                                ? value
                                  ? new Date(value).toLocaleDateString("en-ZA")
                                  : "—"
                                : value || "—"}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  </div>
)}


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
          <CardContent className="flex flex-col gap-4 p-5">
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
  const selectedFiles = Array.from(event.target.files || []);
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

            <div className="grid gap-3 sm:grid-cols-2">
  <Button
    type="button"
    variant={uploadMode === "normal" ? "default" : "outline"}
    className="h-auto justify-start whitespace-normal p-4"
    onClick={() => setUploadMode("normal")}
  >
    <div className="text-left">
      <div className="font-semibold">Normal Document</div>
      <p className="mt-1 text-xs font-normal opacity-80">
        Upload documents for viewing and downloading.
      </p>
    </div>
  </Button>

  <Button
    type="button"
    variant={uploadMode === "fillable_form" ? "default" : "outline"}
    className="h-auto justify-start whitespace-normal p-4"
    onClick={() => setUploadMode("fillable_form")}
  >
    <div className="text-left">
      <div className="font-semibold">Fillable Form</div>
      <p className="mt-1 text-xs font-normal opacity-80">
        Upload a blank master document to create an editable digital form.
      </p>
    </div>
  </Button>
</div>
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
                      <div className="flex flex-wrap items-center gap-2">
  <h3 className="break-words font-medium">
    {document.document_name}
  </h3>

  <Badge
    variant={document.document_mode === "fillable_form" ? "default" : "secondary"}
  >
    {document.document_mode === "fillable_form"
      ? "Fillable Form"
      : "Normal Document"}
  </Badge>
</div>FactoryDocumentLibrary
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
      
      {/* Digital NCR Form */}
      {selectedDigitalDocument && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {digitalTemplate.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {digitalTemplate.documentNumber} · {factoryName}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDigitalDocument(null);
                  setNcrFormValues({});
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documents
              </Button>
            </div>

            {loadingDigitalTemplate ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading form...</span>
              </div>
            ) : (
              <>
                {digitalTemplate.sections.map((section) => (
                  <Card key={section.id}>
                    <CardContent className="space-y-5 p-5">
                      <div>
                        <h2 className="text-lg font-semibold">
                          {section.title}
                        </h2>

                        {section.description && (
                          <p className="text-sm text-muted-foreground">
                            {section.description}
                          </p>
                        )}
                      </div>

                      <div
                        className="grid gap-4"
                        style={{
                          gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
                        }}
                      >
                        {section.fields.map((field) => (
                          <div
                            key={field.id}
                            className={
                              field.width === "full"
                                ? "col-span-full space-y-2"
                                : field.width === "half"
                                  ? "col-span-1 space-y-2"
                                  : "col-span-1 space-y-2"
                            }
                          >
                            <label className="text-sm font-medium">
                              {field.label}
                              {field.required && (
                                <span className="ml-1 text-destructive">*</span>
                              )}
                            </label>

                            {field.type === "textarea" ? (
                              <textarea
                                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder={field.placeholder || ""}
                                value={ncrFormValues[field.name] || ""}
                                onChange={(event) =>
                                  setNcrFormValues((previous) => ({
                                    ...previous,
                                    [field.name]: event.target.value,
                                  }))
                                }
                              />
                            ) : field.type === "select" ? (
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={ncrFormValues[field.name] || ""}
                                onChange={(event) =>
                                  setNcrFormValues((previous) => ({
                                    ...previous,
                                    [field.name]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select an option</option>
                                {(field.options || []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(ncrFormValues[field.name])}
                                  onChange={(event) =>
                                    setNcrFormValues((previous) => ({
                                      ...previous,
                                      [field.name]: event.target.checked,
                                    }))
                                  }
                                />
                                <span className="text-sm">
                                  {field.placeholder || field.label}
                                </span>
                              </label>
                            ) : field.type === "radio" ? (
                              <div className="flex flex-wrap gap-4">
                                {(field.options || []).map((option) => (
                                  <label
                                    key={option}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <input
                                      type="radio"
                                      name={field.name}
                                      value={option}
                                      checked={
                                        ncrFormValues[field.name] === option
                                      }
                                      onChange={() =>
                                        setNcrFormValues((previous) => ({
                                          ...previous,
                                          [field.name]: option,
                                        }))
                                      }
                                    />
                                    {option}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <Input
                                type={
                                  field.type === "signature"
                                    ? "text"
                                    : field.type
                                }
                                placeholder={
                                  field.placeholder ||
                                  (field.type === "signature"
                                    ? "Enter name as signature"
                                    : "")
                                }
                                value={ncrFormValues[field.name] || ""}
                                onChange={(event) =>
                                  setNcrFormValues((previous) => ({
                                    ...previous,
                                    [field.name]: event.target.value,
                                  }))
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}              
                <div className="flex justify-end gap-3 pb-8">
                  <Button
                    variant="outline"
                    onClick={() => setNcrFormValues({})}
                    disabled={savingNCR}
                  >
                    Clear Form
                  </Button>

                  <Button
                    onClick={handleSaveNCR}
                    disabled={savingNCR}
                  >
                    {savingNCR ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving NCR...
                      </>
                    ) : (
                      "Submit NCR"
                    )}
                  </Button>
                </div>

              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default FactoryDocumentLibrary;
