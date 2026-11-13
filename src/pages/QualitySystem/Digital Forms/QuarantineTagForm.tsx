
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFMSAuth } from "@/context/FMSAuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, Save, Loader2 } from "lucide-react";

interface QuarantineTagFormProps {
  factory: "rockwood" | "nguni";
  uploadedDocumentId?: string;
  onClose?: () => void;
}

const QuarantineTagForm: React.FC<QuarantineTagFormProps> = ({
  factory,
  uploadedDocumentId,
  onClose,
}) => {
  const { fmsUser } = useFMSAuth();

  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    dateQuarantined: "",
    tagNumber: "",
    productDescription: "",
    reasonForQuarantine: "",
    customerName: "",
    supplierName: "",
    quantityInQuarantine: "",
    batchNumber: "",
    deliveryNoteNumber: "",
    ncrNumber: "",
    name: "",
    signature: "",
    releaseDecision: "",
    authorisingSignature: "",
    authorisationDate: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  
const handleSave = async () => {
  if (!fmsUser) {
    toast.error("Please log in before saving this form.");
    return;
  }

  if (
    !formData.dateQuarantined ||
    !formData.tagNumber ||
    !formData.productDescription ||
    !formData.reasonForQuarantine
  ) {
    toast.error("Please complete the required quarantine details.");
    return;
  }

  setSaving(true);

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;

    const userId = authData.user?.id;

    if (!userId) {
      throw new Error("Your login session could not be verified.");
    }

    const { error } = await (supabase as any)
      .from("fms_quality_records")
      .insert({
        document_id: null,
        uploaded_document_id: uploadedDocumentId || null,
        record_number: formData.tagNumber,
        title: `Quarantine Tag - ${formData.tagNumber}`,
        form_data: {
          ...formData,
          template_key: "quarantine-tag",
          template_version: 1,
        },
        status: "submitted",
        created_by: userId,
        updated_by: userId,
        submitted_at: new Date().toISOString(),
        factory,
      });

    if (error) throw error;

    toast.success("Quarantine Tag saved successfully!");

    setFormData({
      dateQuarantined: "",
      tagNumber: "",
      productDescription: "",
      reasonForQuarantine: "",
      customerName: "",
      supplierName: "",
      quantityInQuarantine: "",
      batchNumber: "",
      deliveryNoteNumber: "",
      ncrNumber: "",
      name: "",
      signature: "",
      releaseDecision: "",
      authorisingSignature: "",
      authorisationDate: "",
    });
  } catch (error: any) {
    console.error("Error saving Quarantine Tag:", error);
    toast.error(error.message || "Could not save Quarantine Tag.");
  } finally {
    setSaving(false);
  }
};


  
return (
  <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
    <div className="mx-auto max-w-4xl space-y-4">

      <div className="flex justify-between gap-2 print:hidden">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="border-2 border-black bg-white p-6 text-black shadow-sm print:border-0 print:shadow-none">
        
<div className="mt-8 flex justify-end border-t border-black pt-5 print:hidden">
  <Button
    onClick={handleSave}
    disabled={saving}
    className="bg-green-700 text-white hover:bg-green-800"
  >
    {saving ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Saving...
      </>
    ) : (
      <>
        <Save className="mr-2 h-4 w-4" />
        Save Quarantine Tag
      </>
    )}
  </Button>
</div>


        <div className="grid grid-cols-3 items-center border-b-2 border-black pb-4">
          <div>
            <img
              src="/images/mslogo.png"
              alt="Maharaja's Spices"
              className="h-20 w-28 object-contain"
            />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold uppercase">
              Quarantine Tag
            </h1>
            <p className="mt-1 text-sm font-semibold">
              MAHARAJA'S SPICES
            </p>
          </div>

          <div className="text-right text-xs">
            <p><strong>Doc No:</strong> MS Q002 FORM 2</p>
            <p><strong>Issue Date:</strong> 12/06/2019</p>
            <p><strong>Version:</strong> 2</p>
            <p><strong>Rev Date:</strong> 14/01/2025</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-b border-black pb-3 text-xs">
          <p><strong>Compiled By:</strong> Tania Naicker</p>
          <p><strong>Approved By:</strong> Livinia Govender</p>
        </div>

        <div className="mt-5 text-center">
          <h2 className="text-lg font-bold underline">
            QUARANTINE DETAILS
          </h2>
        </div>

        
<div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">

  <div>
    <label className="mb-1 block font-semibold">Date Quarantined</label>
    <Input
      type="date"
      value={formData.dateQuarantined}
      onChange={(e) => updateField("dateQuarantined", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Tag No.</label>
    <Input
      value={formData.tagNumber}
      onChange={(e) => updateField("tagNumber", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div className="col-span-2">
    <label className="mb-1 block font-semibold">Product Description</label>
    <Input
      value={formData.productDescription}
      onChange={(e) => updateField("productDescription", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div className="col-span-2">
    <label className="mb-1 block font-semibold">Reason for Quarantine</label>
    <Textarea
      value={formData.reasonForQuarantine}
      onChange={(e) => updateField("reasonForQuarantine", e.target.value)}
      className="min-h-20 border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Name of Customer</label>
    <Input
      value={formData.customerName}
      onChange={(e) => updateField("customerName", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Name of Supplier</label>
    <Input
      value={formData.supplierName}
      onChange={(e) => updateField("supplierName", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Quantity in Quarantine</label>
    <Input
      type="number"
      value={formData.quantityInQuarantine}
      onChange={(e) => updateField("quantityInQuarantine", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Batch Number</label>
    <Input
      value={formData.batchNumber}
      onChange={(e) => updateField("batchNumber", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Delivery Note No.</label>
    <Input
      value={formData.deliveryNoteNumber}
      onChange={(e) => updateField("deliveryNoteNumber", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">NCR No.</label>
    <Input
      value={formData.ncrNumber}
      onChange={(e) => updateField("ncrNumber", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Name</label>
    <Input
      value={formData.name}
      onChange={(e) => updateField("name", e.target.value)}
      className="border-black text-black"
    />
  </div>

  <div>
    <label className="mb-1 block font-semibold">Signature</label>
    <Input
      value={formData.signature}
      onChange={(e) => updateField("signature", e.target.value)}
      className="border-black text-black"
    />
  </div>

</div>


      </div>
    </div>
  </div>
);

};

export default QuarantineTagForm;
