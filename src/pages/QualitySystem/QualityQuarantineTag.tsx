
import React, { useState } from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Printer, Save } from 'lucide-react';

interface QualityQuarantineTagProps {
  documentId: string;
}

const initialForm = {
  dateQuarantined: '',
  tagNumber: '',
  productDescription: '',
  reasonForQuarantine: '',
  customerName: '',
  supplierName: '',
  quantity: '',
  batchNumber: '',
  deliveryNoteNumber: '',
  ncrNumber: '',
  name: '',
  signature: '',
  releaseDisposition: '',
  releaseSignature: '',
  releaseDate: '',
};

const releaseOptions = [
  'Return to Supplier',
  'Accept on concession',
  'Return to stock',
  'Sell on concession',
  'Rework',
  'Scrap',
];

const QualityQuarantineTag: React.FC<QualityQuarantineTagProps> = ({
  documentId,
}) => {
  const { user } = useFMSAuth();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

  const labelClass = 'mb-1 block text-sm font-medium';

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in before saving this quarantine tag.',
        variant: 'destructive',
      });
      return;
    }

    if (
      !form.tagNumber.trim() ||
      !form.productDescription.trim() ||
      !form.reasonForQuarantine.trim()
    ) {
      toast({
        title: 'Required information missing',
        description: 'Please enter the Tag Number, Product Description and Reason for Quarantine.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('fms_quality_records')
        .insert({
          document_id: documentId,
          record_number: form.tagNumber.trim(),
          title: `Quarantine Tag ${form.tagNumber.trim()}`,
          form_data: form,
          status: 'draft',
          created_by: user.id,
          updated_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Quarantine tag saved',
        description: 'The quarantine record has been saved successfully.',
      });

      setForm(initialForm);
    } catch (error: any) {
      console.error('Error saving quarantine tag:', error);

      toast({
        title: 'Unable to save quarantine tag',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Quarantine Tag</h2>
          <p className="text-sm text-muted-foreground">
            Complete and save a quarantine record.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Tag'}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 rounded-lg border bg-background p-6 sm:p-8">
        <div className="border-b pb-5 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            Quarantine Tag
          </h1>
          <p className="mt-2 text-sm font-semibold">
            MSRQ2-FRM-2
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm sm:grid-cols-3">
            <p>Issue Date: <strong>01/05/2026</strong></p>
            <p>Version No.: <strong>0</strong></p>
            <p>Rev Date: <strong>N/A</strong></p>
            <p>Compiled By: <strong>Tania Naicker</strong></p>
            <p>Approved By: <strong>Bradley Pillay</strong></p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="border-b pb-2 font-semibold">Quarantine Details</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Date Quarantined</label>
              <input
                type="date"
                className={inputClass}
                value={form.dateQuarantined}
                onChange={(e) => updateField('dateQuarantined', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Tag No. *</label>
              <input
                className={inputClass}
                value={form.tagNumber}
                onChange={(e) => updateField('tagNumber', e.target.value)}
                placeholder="Enter tag number"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Product Description *</label>
              <textarea
                className={inputClass}
                rows={2}
                value={form.productDescription}
                onChange={(e) => updateField('productDescription', e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Reason for Quarantine *</label>
              <textarea
                className={inputClass}
                rows={3}
                value={form.reasonForQuarantine}
                onChange={(e) => updateField('reasonForQuarantine', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Name of Customer</label>
              <input
                className={inputClass}
                value={form.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Name of Supplier</label>
              <input
                className={inputClass}
                value={form.supplierName}
                onChange={(e) => updateField('supplierName', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Quantity in Quarantine</label>
              <input
                className={inputClass}
                value={form.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Batch Number</label>
              <input
                className={inputClass}
                value={form.batchNumber}
                onChange={(e) => updateField('batchNumber', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Delivery Note No.</label>
              <input
                className={inputClass}
                value={form.deliveryNoteNumber}
                onChange={(e) => updateField('deliveryNoteNumber', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>NCR No.</label>
              <input
                className={inputClass}
                value={form.ncrNumber}
                onChange={(e) => updateField('ncrNumber', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Signature</label>
              <input
                className={inputClass}
                value={form.signature}
                onChange={(e) => updateField('signature', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t pt-5">
          <h3 className="border-b pb-2 font-semibold">Release</h3>

          <p className="text-sm text-muted-foreground">
            Select the approved disposition for the quarantined product.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {releaseOptions.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
              >
                <input
                  type="radio"
                  name="releaseDisposition"
                  value={option}
                  checked={form.releaseDisposition === option}
                  onChange={(e) =>
                    updateField('releaseDisposition', e.target.value)
                  }
                />
                <span className="text-sm font-medium">{option}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Release Signature</label>
              <input
                className={inputClass}
                value={form.releaseSignature}
                onChange={(e) => updateField('releaseSignature', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Release Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.releaseDate}
                onChange={(e) => updateField('releaseDate', e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="border-t pt-4 text-center text-xs text-muted-foreground">
          Doc No.: MSRQ2-FRM-2 | Page 1 of 1 | Version No.: 0
          <p className="mt-2">
            Controlled document – Printed copies are uncontrolled unless otherwise authorised.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QualityQuarantineTag;
