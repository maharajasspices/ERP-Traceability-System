
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Printer, Save } from 'lucide-react';

interface QualityConcessionFormProps {
  documentId: string;
}

interface ConcessionFormData {
  date: string;
  concessionNumber: string;
  productDescription: string;
  reasonForConcession: string;
  requestingPerson: string;
  requesterSignature: string;
  accepted: string;
  price: string;
  deliveryNoteNumber: string;
  invoiceNumber: string;
  ncrNumber: string;
  decisionReason: string;
  companyName: string;
  contactPerson: string;
  address: string;
  acceptingSignature: string;
  acceptanceDate: string;
}

const initialForm: ConcessionFormData = {
  date: '',
  concessionNumber: '',
  productDescription: '',
  reasonForConcession: '',
  requestingPerson: '',
  requesterSignature: '',
  accepted: '',
  price: '',
  deliveryNoteNumber: '',
  invoiceNumber: '',
  ncrNumber: '',
  decisionReason: '',
  companyName: '',
  contactPerson: '',
  address: '',
  acceptingSignature: '',
  acceptanceDate: '',
};

const QualityConcessionForm = ({
  documentId,
}: QualityConcessionFormProps) => {
  const { user } = useFMSAuth();

  const [form, setForm] = useState<ConcessionFormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const update = (field: keyof ConcessionFormData, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setSavedRecordId(null);
  };

  const field = (
    label: string,
    name: keyof ConcessionFormData,
    type = 'text'
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type={type}
        value={form[name]}
        onChange={(event) => update(name, event.target.value)}
      />
    </div>
  );

  const area = (
    label: string,
    name: keyof ConcessionFormData,
    rows = 3
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Textarea
        rows={rows}
        value={form[name]}
        onChange={(event) => update(name, event.target.value)}
        className="min-h-[90px]"
      />
    </div>
  );

  const saveRecord = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to save this record.');
      return;
    }

    if (!form.productDescription.trim()) {
      toast.error('Please enter the Product Description.');
      return;
    }

    if (!form.concessionNumber.trim()) {
      toast.error('Please enter the concession number.');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('fms_quality_records')
        .insert({
          document_id: documentId,
          record_number: form.concessionNumber.trim(),
          title: `Concession Record - ${form.concessionNumber.trim()}`,
          form_data: form,
          status: 'draft',
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      setSavedRecordId(data.id);
      toast.success('Concession record saved successfully.');
    } catch (error: any) {
      console.error('Error saving concession record:', error);
      toast.error(error.message || 'Could not save the concession record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Concession Record</h2>
          <p className="text-sm text-muted-foreground">
            Complete the form and save it as a separate quality record.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Download PDF
          </Button>

          <Button onClick={saveRecord} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Record'}
          </Button>
        </div>
      </div>

      {savedRecordId && (
        <p className="text-sm text-green-700 print:hidden">
          Record saved successfully. You can now print or download it as a PDF.
        </p>
      )}

      <div className="rounded-lg border bg-white p-5 text-black sm:p-8">
        <div className="mb-8 border-b pb-5 text-center">
          <h1 className="text-2xl font-bold uppercase">
            Concession Record
          </h1>
          <p className="mt-2 text-sm">Doc No.: MSRQ2-FRM-3</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm sm:grid-cols-3">
            <p>Issue Date: 01/05/2026</p>
            <p>Version No.: 0</p>
            <p>Rev Date: N/A</p>
            <p>Compiled By: Tania Naicker</p>
            <p>Approved By: Bradley Pillay</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Date', 'date', 'date')}
            {field('Concession Number', 'concessionNumber')}
          </div>

          {area('Product Description', 'productDescription', 3)}
          {area('Reason for Concession', 'reasonForConcession', 3)}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Name of Person Requesting Concession', 'requestingPerson')}
            {field('Signature of Requesting Person', 'requesterSignature')}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Concession Accepted
              </label>
              <select
                value={form.accepted}
                onChange={(event) => update('accepted', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {field('Price', 'price')}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {field('Delivery Note No.', 'deliveryNoteNumber')}
            {field('Invoice No.', 'invoiceNumber')}
            {field('NCR No.', 'ncrNumber')}
          </div>

          {area(
            'Reason for Accepting / Not Accepting Concession',
            'decisionReason',
            4
          )}

          <div className="border-t pt-5">
            <h2 className="mb-4 text-lg font-bold uppercase">
              Person Accepting Concession
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field('Company Name', 'companyName')}
                {field('Contact Person', 'contactPerson')}
              </div>

              {area('Address', 'address', 3)}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field('Signature', 'acceptingSignature')}
                {field('Date', 'acceptanceDate', 'date')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-3 text-center text-xs text-muted-foreground">
          Maharaja's Spices – Controlled Quality Record
        </div>
      </div>
    </div>
  );
};

export default QualityConcessionForm;
