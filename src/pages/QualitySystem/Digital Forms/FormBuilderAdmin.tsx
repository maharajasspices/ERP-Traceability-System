
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFMSAuth } from "@/context/FMSAuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Loader2, Upload, FileText } from "lucide-react";

import * as pdfjsDist from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsDist.GlobalWorkerOptions.workerSrc = workerUrl;


interface FieldConfig {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "textarea";
  required?: boolean;
}

interface FormTemplate {
  id: string;
  name: string;
  documentNumber: string;
  factory: "rockwood" | "nguni" | "both";
  fields: FieldConfig[];
  isPublished: boolean;
  pdfUrl?: string;
  textItems?: any[];
  placedFields?: any[];
}

const STORAGE_BUCKET = "quality-documents";

const FormBuilderAdmin: React.FC = () => {
  const { user, isAdmin } = useFMSAuth();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [documentNumber, setDocumentNumber] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [category, setCategory] = useState("Forms");
  const [factory, setFactory] = useState("both");
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [extractedFields, setExtractedFields] = useState<FieldConfig[]>([]);
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [placedFields, setPlacedFields] = useState<any[]>([]);

  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Load placedFields from template content when a template is selected
  useEffect(() => {
    const loadPlacedFieldsFromTemplate = async () => {
      if (uploadedPdf) {
        const { data: existingTemplates } = await supabase
          .from('fms_quality_documents')
          .select('content')
          .eq('document_no', documentNumber.trim())
          .maybeSingle();

       if (existingTemplates?.content) {
  const savedContent =
    typeof existingTemplates.content === "string"
      ? JSON.parse(existingTemplates.content)
      : existingTemplates.content;

  setPlacedFields(savedContent.placedFields || []);
  setFieldConfig(savedContent.fields || []);
}
      }
    };

    loadPlacedFieldsFromTemplate();
  }, [uploadedPdf, documentNumber]);

  const loadTemplates = async () => {
    setFetching(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_documents")
        .select(
          "id, document_no, title, category, document_type, version_no, status, rockwood, nguni"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates((data || []) as FormTemplate[]);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Could not load quality documents.");
    } finally {
      setFetching(false);
    }
  };

  const handlePublish = async () => {
    if (!isAdmin) {
      toast.error("Only system administrators can publish templates.");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in again.");
      return;
    }

    if (!documentNumber.trim() || !documentName.trim()) {
      toast.error("Please enter the document number and name.");
      return;
    }

    if (!uploadedPdf || uploadedPdf.type !== "application/pdf") {
      toast.error("Please select a PDF document.");
      return;
    }

    setLoading(true);

    let uploadedPath = "";

    try {
      const safeDocumentNumber = documentNumber
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const safeFileName = uploadedPdf.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      uploadedPath = `${user.id}/${safeDocumentNumber}/${Date.now()}-${safeFileName}`;

      // Upload the original PDF to Supabase Storage.
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(uploadedPath, uploadedPdf, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const rockwood = factory === "rockwood" || factory === "both";
      const nguni = factory === "nguni" || factory === "both";

      // Keep the PDF location and form-builder information in content.
      const content = JSON.stringify({
        templateKey: documentNumber.trim(),
        templateVersion: 1,
        pdfStoragePath: uploadedPath,
        pdfFileName: uploadedPdf.name,
        fields: fieldConfig,
        placedFields: placedFields.map((field: any) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required,
        })),
      });

      // Check whether this document number already exists.
      const { data: existing, error: lookupError } = await (supabase as any)
        .from("fms_quality_documents")
        .select("id")
        .eq("document_no", documentNumber.trim())
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      const documentData = {
        document_no: documentNumber.trim(),
        title: documentName.trim(),
        category: category.trim(),
        document_type: "Form",
        version_no: "1.0",
        content,
        status: "draft",
        rockwood,
        nguni,
        updated_by: user.id,
      };

      if (existing) {
        const { error: updateError } = await (supabase as any)
          .from("fms_quality_documents")
          .update(documentData)
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase as any)
          .from("fms_quality_documents")
          .insert({
            ...documentData,
            created_by: user.id,
          });

        if (insertError) throw insertError;
      }

      toast.success("PDF template saved successfully.");

      setDocumentNumber("");
      setDocumentName("");
      setCategory("Forms");
      setFactory("both");
      setUploadedPdf(null);

      const fileInput = document.getElementById(
        "template-pdf"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      await loadTemplates();
    } catch (error: any) {
      console.error("Error publishing template:", error);

      // Remove the uploaded PDF if saving its database record failed.
      if (uploadedPath) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([uploadedPath]);
      }

      toast.error(
        error?.message || "Failed to save the PDF template."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            You do not have permission to manage form templates.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          Digital Form Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage controlled quality document templates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            Upload New PDF Template
          </h2>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Document Number
            </label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="e.g. MSRQ2-FRM-1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Document Name
            </label>
            <Input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Category
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Forms, Registers, SOPs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Factory
            </label>
            <select
              value={factory}
              onChange={(e) => setFactory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="both">Both factories</option>
              <option value="rockwood">Rockwood only</option>
              <option value="nguni">Nguni only</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Original PDF Document
            </label>

            <Input
              id="template-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) =>
                setUploadedPdf(e.target.files?.[0] || null)
              }
            />

            {uploadedPdf && (
              <p className="text-sm text-muted-foreground">
                Selected: {uploadedPdf.name}
              </p>
            )}
          </div>

          <Button
            onClick={handlePublish}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Template...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Save PDF Template
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            Existing Quality Documents
          </h2>
        </CardHeader>

        <CardContent>
          {fetching ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents found.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {template.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {template.document_no} ·{" "}
                      {template.rockwood && template.nguni
                        ? "Both factories"
                        : template.rockwood
                        ? "Rockwood"
                        : template.nguni
                        ? "Nguni"
                        : "No factory assigned"}
                    </p>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {template.status || "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FormBuilderAdmin;