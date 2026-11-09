import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  Search,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  ClipboardList,
  Calendar,
  User,
  Upload,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";

type QualityDocument = {
  id: string;
  title: string;
  documentNumber: string;
  category: string;
  description: string;
  type: "Procedure" | "Form" | "Register";
  version: string;
  issueDate: string;
  compiledBy?: string;
  approvedBy?: string;
  status: string;
  relatedDocumentIds?: string[];
};

type DocumentCategory = {
  name: string;
  description: string;
  folders: string[];
};

type UploadedQualityDocument = {
  id: string;
  document_name: string;
  document_number: string | null;
  category: string;
  subcategory: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string;
  created_at: string;
};

const documentCategories: DocumentCategory[] = [
  {
    name: "Standard Operating Procedures – Rockwood",
    description: "Controlled operating procedures for the Rockwood factory.",
    folders: [],
  },
  {
    name: "Standard Operating Procedures – Nguni",
    description: "Controlled operating procedures for the Nguni factory.",
    folders: [],
  },
  {
    name: "Working Instructions",
    description: "Departmental and operational working instructions.",
    folders: [],
  },
  {
    name: "Policies",
    description: "Company policies and quality management policies.",
    folders: [],
  },
  {
    name: "Raw materials",
    description: "Specifications for raw materials.",
    folders: [],
  },
  {
    name: "Packaging materials",
    description: "Specifications for packaging materials.",
    folders: [],
  },
  {
    name: "Finished goods",
    description: "Specifications for finished products.",
    folders: [],
  },
  {
    name: "Cleaning Chemicals",
    description: "Specifications and documents for cleaning chemicals.",
    folders: [],
  },
  {
    name: "Process Flow Diagrams",
    description: "Factory and production process flow diagrams.",
    folders: [],
  },
  {
    name: "Floor Plan",
    description: "Factory and facility floor plans.",
    folders: [],
  },
  {
    name: "Lab results",
    description: "External laboratory results and reports.",
    folders: [],
  },
  {
    name: "Calibration certificates",
    description: "Equipment and instrument calibration certificates.",
    folders: [],
  },
  {
    name: "Halaal Certification",
    description: "Halaal certificates and supporting documents.",
    folders: [],
  },
  {
    name: "R638 Certificate",
    description: "R638 compliance certificates.",
    folders: [],
  },
  {
    name: "Food Quality & Safety Certificate",
    description: "Food quality and food safety certificates.",
    folders: [],
  },
  {
    name: "Appointment letters",
    description: "Employee appointment letters.",
    folders: [],
  },
  {
    name: "Job Descriptions & Organograms",
    description: "Job descriptions, responsibilities and organisational structures.",
    folders: [],
  },
  {
    name: "Training Presentations",
    description: "Employee training presentations and materials.",
    folders: [],
  },
]

const qualityDocuments: QualityDocument[] = [
  {
    id: "non-conformance-procedure",
    title: "Control of Non-Conformance Procedure",
    documentNumber: "MSNQ2-SOP-1",
    category: "Quality Management Procedures",
    description:
      "Procedure for identifying, reporting, investigating, isolating and controlling non-conforming products and materials.",
    type: "Procedure",
    version: "0",
    issueDate: "01/05/2026",
    compiledBy: "Tania Naicker",
    approvedBy: "Bradley Pillay",
    status: "Master document",
    relatedDocumentIds: [
      "non-conformance-form",
      "quarantine-tag",
      "concession-record",
      "non-conformance-log",
      "quarantine-register",
    ],
  },
  {
    id: "non-conformance-form",
    title: "Non-Conformance Record Form",
    documentNumber: "MSRQ2-FRM-1",
    category: "Forms & Records",
    description:
      "Record details of a reported non-conformance, its criticality, investigation, disposition and corrective measures.",
    type: "Form",
    version: "0",
    issueDate: "Not yet configured",
    status: "Template to be created",
  },
  {
    id: "quarantine-tag",
    title: "Quarantine Tag",
    documentNumber: "MSRQ2-FRM-2",
    category: "Forms & Records",
    description:
      "Identify and label non-conforming products or materials placed in quarantine.",
    type: "Form",
    version: "0",
    issueDate: "Not yet configured",
    status: "Template to be created",
  },
  {
    id: "concession-record",
    title: "Concession Record",
    documentNumber: "MSRQ2-FRM-3",
    category: "Forms & Records",
    description:
      "Record and authorise the sale or use of non-conforming product or material under an approved concession.",
    type: "Form",
    version: "0",
    issueDate: "Not yet configured",
    status: "Template to be created",
  },
  {
    id: "non-conformance-log",
    title: "Non-Conformance Report Logbook",
    documentNumber: "MSRQ2-LOG-1",
    category: "Forms & Records",
    description:
      "Register reported non-conformances and track their status and closure.",
    type: "Register",
    version: "0",
    issueDate: "Not yet configured",
    status: "Template to be created",
  },
  {
    id: "quarantine-register",
    title: "Quarantine Register",
    documentNumber: "MSRQ2-LOG-2",
    category: "Forms & Records",
    description:
      "Track products and materials placed in quarantine, including their identification and final disposition.",
    type: "Register",
    version: "0",
    issueDate: "Not yet configured",
    status: "Template to be created",
  },
];

const QualityDocuments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
  requestedCategory
);
const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
const navigate = useNavigate();
const fileInputRef = useRef<HTMLInputElement>(null);

const [uploadedDocuments, setUploadedDocuments] = useState<
  UploadedQualityDocument[]
>([]);

const [loadingUploads, setLoadingUploads] = useState(false);
const [uploading, setUploading] = useState(false);

const [uploadForm, setUploadForm] = useState({
  documentName: "",
  documentNumber: "",
  description: "",
});

const [selectedFile, setSelectedFile] = useState<File | null>(null);
const loadUploadedDocuments = async () => {
  setLoadingUploads(true);

  try {
    const { data, error } = await (supabase as any)
      .from("fms_quality_uploaded_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    setUploadedDocuments(data || []);
  } catch (error: any) {
    console.error("Error loading Quality documents:", error);
    toast.error("Could not load uploaded documents.");
  } finally {
    setLoadingUploads(false);
  }
};

useEffect(() => {
  loadUploadedDocuments();
}, []);

const handleUploadDocument = async () => {
  if (!selectedCategory) {
    toast.error("Please select a document category.");
    return;
  }

  if (!uploadForm.documentName.trim()) {
    toast.error("Please enter a document name.");
    return;
  }

  if (!selectedFile) {
    toast.error("Please select a file to upload.");
    return;
  }

  if (selectedFile.size > 50 * 1024 * 1024) {
    toast.error("The maximum file size is 50 MB.");
    return;
  }

  const parentCategories: Record<string, string> = {
    "Standard Operating Procedures – Rockwood": "Controlled Documents",
    "Standard Operating Procedures – Nguni": "Controlled Documents",
    "Working Instructions": "Controlled Documents",
    Policies: "Controlled Documents",

    "Raw materials": "Specifications & Technical Documents",
    "Packaging materials": "Specifications & Technical Documents",
    "Finished goods": "Specifications & Technical Documents",
    "Cleaning Chemicals": "Specifications & Technical Documents",
    "Process Flow Diagrams": "Specifications & Technical Documents",
    "Floor Plan": "Specifications & Technical Documents",

    "Lab results": "Compliance & Certifications",
    "Calibration certificates": "Compliance & Certifications",
    "Halaal Certification": "Compliance & Certifications",
    "R638 Certificate": "Compliance & Certifications",
    "Food Quality & Safety Certificate": "Compliance & Certifications",

    "Appointment letters": "HR & Training Documents",
    "Job Descriptions & Organograms": "HR & Training Documents",
    "Training Presentations": "HR & Training Documents",
  };

  const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeCategory = selectedCategory.replace(/[^a-zA-Z0-9_-]/g, "_");

  const filePath = `${safeCategory}/${Date.now()}-${safeFileName}`;

  setUploading(true);

  try {
    // Upload the actual file to private Supabase Storage.
    const { error: storageError } = await supabase.storage
      .from("quality-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedFile.type || undefined,
      });

    if (storageError) {
      throw storageError;
    }

    // Save the document details in the database.
    const { error: databaseError } = await (supabase as any)
      .from("fms_quality_uploaded_documents")
      .insert({
        document_name: uploadForm.documentName.trim(),
        document_number: uploadForm.documentNumber.trim() || null,
        category: parentCategories[selectedCategory] || "Other",
        subcategory: selectedCategory,
        file_path: filePath,
        file_type: selectedFile.type || null,
        file_size: selectedFile.size,
        description: uploadForm.description.trim() || null,
      });

    if (databaseError) {
      console.error("Document metadata save error:", databaseError);
      throw new Error(
        "The file was uploaded, but its document details could not be saved. Please contact your administrator."
      );
    }

    toast.success("Document uploaded successfully!");

    setUploadForm({
      documentName: "",
      documentNumber: "",
      description: "",
    });

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await loadUploadedDocuments();
  } catch (error: any) {
    console.error("Quality document upload error:", error);
    toast.error(error.message || "Document upload failed.");
  } finally {
    setUploading(false);
  }
};
useEffect(() => {
  if (
    requestedCategory &&
    documentCategories.some(
      (category) => category.name === requestedCategory
    )
  ) {
    setSelectedCategory(requestedCategory);
    setSelectedFolder(null);
    setSelectedDocumentId(null);
    setSearchTerm("");
  }
}, [requestedCategory]);
  const currentCategory = documentCategories.find(
    (category) => category.name === selectedCategory
  );

  const selectedDocument = qualityDocuments.find(
    (document) => document.id === selectedDocumentId
  );

  const filteredCategories = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) return documentCategories;

    return documentCategories.filter(
      (category) =>
        category.name.toLowerCase().includes(search) ||
        category.description.toLowerCase().includes(search) ||
        category.folders.some((folder) =>
          folder.toLowerCase().includes(search)
        ) ||
        qualityDocuments.some(
          (document) =>
            document.category === category.name &&
            (document.title.toLowerCase().includes(search) ||
              document.documentNumber.toLowerCase().includes(search))
        )
    );
  }, [searchTerm]);

  const categoryDocuments = qualityDocuments.filter(
    (document) => document.category === selectedCategory
  );

  const relatedDocuments =
    selectedDocument?.relatedDocumentIds
      ?.map((id) => qualityDocuments.find((document) => document.id === id))
      .filter((document): document is QualityDocument => Boolean(document)) ||
    [];

  const openCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedFolder(null);
    setSelectedDocumentId(null);
    setSearchTerm("");
  };

  const goBack = () => {
    if (selectedDocumentId) {
      setSelectedDocumentId(null);
    } else if (selectedFolder) {
      setSelectedFolder(null);
    } else {
      setSelectedCategory(null);
    }
  };

  const resetNavigation = () => {
    setSelectedCategory(null);
    setSelectedFolder(null);
    setSelectedDocumentId(null);
    setSearchTerm("");
  };

  const openDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Quality Documents
            </h1>
            <p className="text-sm text-muted-foreground">
              Controlled document library for Quality Management
            </p>
          </div>
        </div>

        <Badge variant="secondary" className="w-fit">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          {qualityDocuments.length} Documents
        </Badge>
      </div>

      {/* Library information */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="rounded-full bg-primary/10 p-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold">Quality Document Library</h3>
            <p className="text-sm text-muted-foreground">
              Browse controlled procedures, forms, registers, specifications
              and compliance documents.
            </p>
          </div>

          <Badge variant="outline">
            {documentCategories.length} Categories
          </Badge>
        </CardContent>
      </Card>

      {/* Search */}
      {!selectedDocumentId && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories, documents or document numbers..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Breadcrumb navigation */}
      {selectedCategory && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={resetNavigation}>
            All Categories
          </Button>

          <ChevronRight className="h-4 w-4 text-muted-foreground" />

          {selectedDocumentId ? (
            <>
              <button
                onClick={() =>
                navigate(`/quality-system/documents/${encodeURIComponent(document.id)}`)
                }
                className="text-muted-foreground hover:text-foreground"
              >
                {selectedCategory}
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">
                {selectedDocument?.title}
              </span>
            </>
          ) : selectedFolder ? (
            <>
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                {selectedCategory}
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{selectedFolder}</span>
            </>
          ) : (
            <span className="font-semibold">{selectedCategory}</span>
          )}
        </div>
      )}

      {/* All categories */}
      {!selectedCategory && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Document Categories</h2>
            <p className="text-sm text-muted-foreground">
              Select a category to browse its documents and folders.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCategories.map((category) => {
             const count =
  qualityDocuments.filter(
    (document) => document.category === category.name
  ).length +
  uploadedDocuments.filter(
    (document) => document.subcategory === category.name
  ).length;

              return (
                <Card
                  key={category.name}
                  className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                  onClick={() => openCategory(category.name)}
                >
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="rounded-xl bg-amber-500/10 p-3">
                      {category.folders.length > 0 ? (
                        <FolderTree className="h-7 w-7 text-amber-600" />
                      ) : (
                        <Folder className="h-7 w-7 text-amber-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug group-hover:text-primary">
                        {category.name}
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {category.description}
                      </p>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {count > 0
                            ? `${count} documents`
                            : category.folders.length > 0
                              ? `${category.folders.length} subfolders`
                              : "Document folder"}
                        </span>

                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <EmptyState message="No categories or documents found. Try another search term." />
          )}
        </div>
      )}


      {/* Selected document viewer preview */}
      {selectedDocument && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>

            <Badge variant="secondary">{selectedDocument.status}</Badge>
          </div>

          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <FileText className="h-7 w-7 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold">
                    {selectedDocument.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDocument.documentNumber}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedDocument.description}
              </p>

              <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                <DocumentDetail
                  icon={<FileCheck className="h-4 w-4" />}
                  label="Document Type"
                  value={selectedDocument.type}
                />
                <DocumentDetail
                  icon={<FileText className="h-4 w-4" />}
                  label="Version"
                  value={selectedDocument.version}
                />
                <DocumentDetail
                  icon={<Calendar className="h-4 w-4" />}
                  label="Issue Date"
                  value={selectedDocument.issueDate}
                />
                <DocumentDetail
                  icon={<Folder className="h-4 w-4" />}
                  label="Category"
                  value={selectedDocument.category}
                />
                {selectedDocument.compiledBy && (
                  <DocumentDetail
                    icon={<User className="h-4 w-4" />}
                    label="Compiled By"
                    value={selectedDocument.compiledBy}
                  />
                )}
                {selectedDocument.approvedBy && (
                  <DocumentDetail
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Approved By"
                    value={selectedDocument.approvedBy}
                  />
                )}
              </div>

              <div className="rounded-lg border p-5 text-center space-y-3">
                <FileText className="mx-auto h-8 w-8 text-primary" />

                <div>
                  <h3 className="font-semibold">Controlled Document</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the complete document to view its contents, access
                    revision history and download a PDF.
                  </p>
                </div>

                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    navigate(
                      `/quality-system/documents/${encodeURIComponent(
                        selectedDocument.documentNumber
                      )}`
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open Full Document
                </Button>
              </div>

              {relatedDocuments.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Related Forms & Records</h3>
                    <p className="text-sm text-muted-foreground">
                      Documents referenced by this procedure.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {relatedDocuments.map((document) => (
                      <button
                        key={document.id}
                        onClick={() => openDocument(document.id)}
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <ClipboardList className="h-5 w-5 shrink-0 text-primary" />

                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {document.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {document.documentNumber}
                          </span>
                        </span>

                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      

      {/* Selected category */}
      {selectedCategory && !selectedDocumentId && currentCategory && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {currentCategory.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentCategory.description}
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
{/* Upload Document */}
<Card>
  <CardContent className="space-y-4 p-5">
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Upload className="h-5 w-5 text-primary" />
      </div>

      <div>
        <h3 className="font-semibold">Upload Document</h3>
        <p className="text-sm text-muted-foreground">
          Upload a document into {currentCategory.name}.
        </p>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Document Name *</label>
        <Input
          placeholder="Enter document name"
          value={uploadForm.documentName}
          onChange={(event) =>
            setUploadForm({
              ...uploadForm,
              documentName: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Document Number</label>
        <Input
          placeholder="Optional document number"
          value={uploadForm.documentNumber}
          onChange={(event) =>
            setUploadForm({
              ...uploadForm,
              documentNumber: event.target.value,
            })
          }
        />
      </div>
    </div>

    <div className="space-y-2">
      <label className="text-sm font-medium">Description</label>
      <Input
        placeholder="Optional description"
        value={uploadForm.description}
        onChange={(event) =>
          setUploadForm({
            ...uploadForm,
            description: event.target.value,
          })
        }
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-medium">Select File *</label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png"
        onChange={(event) =>
          setSelectedFile(event.target.files?.[0] || null)
        }
        className="block w-full rounded-md border p-2 text-sm"
      />
      <p className="text-xs text-muted-foreground">
        PDF, Word, Excel, PowerPoint, text and image files. Maximum 50 MB.
      </p>
    </div>

    {selectedFile && (
      <p className="text-sm text-muted-foreground">
        Selected: {selectedFile.name}
      </p>
    )}

    <Button
      onClick={handleUploadDocument}
      disabled={uploading}
    >
      {uploading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </>
      )}
    </Button>
  </CardContent>
</Card>
{/* Uploaded Documents */}
<Card>
  <CardContent className="space-y-4 p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">Uploaded Documents</h3>
        <p className="text-sm text-muted-foreground">
          Documents stored in this category.
        </p>
      </div>

      <Badge variant="secondary">
        {
          uploadedDocuments.filter(
            (document) => document.subcategory === selectedCategory
          ).length
        } Documents
      </Badge>
    </div>

    {loadingUploads ? (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading uploaded documents...
      </div>
    ) : uploadedDocuments.filter(
        (document) => document.subcategory === selectedCategory
      ).length === 0 ? (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No uploaded documents in this category yet.
      </p>
    ) : (
      <div className="space-y-2">
        {uploadedDocuments
          .filter(
            (document) => document.subcategory === selectedCategory
          )
          .map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
            >
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-medium">{document.document_name}</h4>

                {document.document_number && (
                  <p className="text-xs text-muted-foreground">
                    {document.document_number}
                  </p>
                )}

                {document.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.description}
                  </p>
                )}

                <p className="mt-1 text-xs text-muted-foreground">
                  Uploaded {new Date(document.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { data, error } = await supabase.storage
                      .from("quality-documents")
                      .createSignedUrl(document.file_path, 60);

                    if (error) {
                      toast.error("Could not open this document.");
                      return;
                    }

                    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { data, error } = await supabase.storage
                      .from("quality-documents")
                      .download(document.file_path);

                    if (error || !data) {
                      toast.error("Could not download this document.");
                      return;
                    }

                    const url = URL.createObjectURL(data);
                    const link = window.document.createElement("a");
                    link.href = url;
                    link.download = document.document_name;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          ))}
      </div>
    )}
  </CardContent>
</Card>

          {/* Documents in category */}
          {categoryDocuments.filter((document) => {
            const search = searchTerm.toLowerCase().trim();
            return (
              !search ||
              document.title.toLowerCase().includes(search) ||
              document.documentNumber.toLowerCase().includes(search)
            );
          }).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryDocuments
                .filter((document) => {
                  const search = searchTerm.toLowerCase().trim();
                  return (
                    !search ||
                    document.title.toLowerCase().includes(search) ||
                    document.documentNumber.toLowerCase().includes(search)
                  );
                })
                .map((document) => (
                  <Card
                    key={document.id}
                    className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
                    onClick={() => openDocument(document.id)}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-snug">
                          {document.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {document.documentNumber}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{document.type}</Badge>
                          <Badge variant="secondary">{document.status}</Badge>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Subfolders */}
          {!selectedFolder && currentCategory.folders.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentCategory.folders
                .filter((folder) =>
                  folder.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((folder) => (
                  <Card
                    key={folder}
                    className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
                    onClick={() => setSelectedFolder(folder)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <FolderOpen className="h-7 w-7 text-amber-600" />
                      <span className="flex-1 font-medium">{folder}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Empty category */}
          {categoryDocuments.length === 0 &&
            currentCategory.folders.length === 0 && (
              <EmptyState message="No documents have been configured in this category yet." />
            )}

          {selectedFolder && (
            <div className="space-y-3">
              <h3 className="font-semibold">{selectedFolder}</h3>
              <EmptyState message="No documents have been configured in this folder yet." />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DocumentDetail: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <FileText className="h-9 w-9 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">Nothing here yet</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
    </CardContent>
  </Card>
);

export default QualityDocuments;
