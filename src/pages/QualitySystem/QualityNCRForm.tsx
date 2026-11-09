
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Printer } from 'lucide-react';

const initialForm = {
  originatorName: '',
  productDescription: '',
  contractorSupplier: '',
  batchNumber: '',
  quantity: '',
  ncrNumber: '',
  foundDuring: '',
  otherActivity: '',
  problemDescription: '',
  immediateAction: '',
  occurrenceDate: '',
  reportingSignature: '',
  reportingSignatureDate: '',
  criticalityLevel: '',
  retestingResult: '',
  disposition: '',
  otherDisposition: '',
  requiredAction: '',
  owner: '',
  dateAssigned: '',
  investigationDueDate: '',
  productionManagerSignature: '',
  documentControllerSignature: '',
  capaApproval: '',
  capaRcaNumber: '',
  ownerName: '',
  ownerDate: '',
  ownerSignature: '',
  qualityDesignee: '',
  dispositionCompleted: '',
  newNcrNumber: '',
  qualitySignature: '',
  qualityDate: '',
};

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const labelClass = 'mb-1 block text-sm font-medium';

const sectionClass =
  'space-y-5 rounded-lg border bg-card p-5 print:break-inside-avoid';

interface QualityNCRFormProps {
  documentId: string;
  recordId?: string | null;
}

const QualityNCRForm = ({ documentId, recordId }: QualityNCRFormProps) => {
  const { user } = useFMSAuth();

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
 const [loadingDocument, setLoadingDocument] = useState(false);
const [masterDocumentId, setMasterDocumentId] = useState<string | null>(
  documentId || null
);
const [savedRecordId, setSavedRecordId] = useState<string | null>(
  recordId || null
);

const [recordStatus, setRecordStatus] = useState<string>('draft');

useEffect(() => {
  if (!recordId || !masterDocumentId) return;

  const loadRecord = async () => {
    try {
      const { data, error } = await supabase
        .from('fms_quality_records')
        .select('id, form_data, status')
        .eq('id', recordId)
        .eq('document_id', masterDocumentId)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('NCR record not found.');
      }

      setForm({
        ...initialForm,
        ...(data.form_data as Partial<typeof initialForm>),
      });

      setSavedRecordId(data.id);
      setRecordStatus(data.status);
    } catch (error: any) {
      console.error('Error loading NCR record:', error);
      toast.error(error.message || 'Unable to load this NCR.');
    }
  };

  loadRecord();
}, [recordId, masterDocumentId]);

useEffect(() => {
  setMasterDocumentId(documentId || null);
}, [documentId]);

  const update = (key: keyof typeof initialForm, value: string) => {
  if (recordStatus !== 'draft') return;

  setForm((prev) => ({ ...prev, [key]: value }));
};

  const field = (
    label: string,
    name: keyof typeof initialForm,
    type = 'text'
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        className={inputClass}
        value={form[name]}
        onChange={(e) => update(name, e.target.value)}
      />
    </div>
  );

  const area = (
    label: string,
    name: keyof typeof initialForm,
    rows = 4
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        rows={rows}
        className={inputClass}
        value={form[name]}
        onChange={(e) => update(name, e.target.value)}
      />
    </div>
  );

  const choice = (
    label: string,
    name: keyof typeof initialForm,
    options: string[]
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        className={inputClass}
        value={form[name]}
        onChange={(e) => update(name, e.target.value)}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );

  
const saveRecord = async () => {
  if (!user?.id) {
    toast.error('You must be logged in to save an NCR.');
    return;
  }

  if (!masterDocumentId) {
    toast.error('The NCR master document is not loaded. Please refresh.');
    return;
  }

  if (recordStatus !== 'draft') {
    toast.error('Only draft NCR records can be edited.');
    return;
  }

  if (!form.originatorName.trim() || !form.problemDescription.trim()) {
    toast.error('Please enter the Originator Name and Problem Description.');
    return;
  }

  if (!form.ncrNumber.trim()) {
    toast.error('Please enter an NCR Number before saving.');
    return;
  }

  setSaving(true);

  try {
    const recordData = {
      document_id: masterDocumentId,
      record_number: form.ncrNumber.trim(),
      title: `Non-Conformance Report ${form.ncrNumber.trim()}`,
      form_data: form,
      updated_by: user.id,
    };

    let data;
    let error;

    if (savedRecordId) {
      const result = await supabase
        .from('fms_quality_records')
        .update(recordData)
        .eq('id', savedRecordId)
        .eq('document_id', masterDocumentId)
        .select('id')
        .single();

      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('fms_quality_records')
        .insert({
          ...recordData,
          status: 'draft',
          created_by: user.id,
        })
        .select('id')
        .single();

      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    setSavedRecordId(data.id);
    toast.success('Non-Conformance Report saved successfully.');
  } catch (error: any) {
    console.error('Error saving NCR:', error);
    toast.error(error.message || 'Unable to save the NCR.');
  } finally {
    setSaving(false);
  }
};
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">
            Non-Conformance Report Form
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete the relevant sections and save the report.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>

          <Button
            onClick={saveRecord}
            disabled={saving || loadingDocument || !masterDocumentId}
          >
            <Save className="mr-2 h-4 w-4" />
            {loadingDocument ? 'Loading...' : saving ? 'Saving...' : 'Save NCR'}
          </Button>
        </div>
      </div>

      {savedRecordId && (
        <p className="text-sm text-green-700 print:hidden">
          This NCR has been saved successfully. You can print it or continue
          completing the form.
        </p>
      )}

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold">
            Non-Conformance Report Form
          </h1>
          <p className="text-sm text-muted-foreground">
            Maharaja's Spices
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Doc No.</p>
            <p className="font-semibold">MSRQ2-FRM-1</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Issue Date</p>
            <p className="font-semibold">01/05/2026</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Version No.</p>
            <p className="font-semibold">0</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rev Date</p>
            <p className="font-semibold">N/A</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Compiled By</p>
            <p className="font-semibold">Tania Naicker</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved By</p>
            <p className="font-semibold">Bradley Pillay</p>
          </div>
        </div>
      </div>

      <section className={sectionClass}>
        <h2 className="text-lg font-bold">
          SECTION 1: To be completed by Reporting Party
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {field('Originator Name', 'originatorName')}
          {field('Product Description', 'productDescription')}
          {field('Contractor / Supplier', 'contractorSupplier')}
          {field('Batch Number', 'batchNumber')}
          {field('Quantity', 'quantity')}
          {field('NCR Number', 'ncrNumber')}
        </div>

        <div>
          <p className={labelClass}>FOUND DURING WHAT ACTIVITY:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {choice('Activity', 'foundDuring', [
              'Incoming Inspection',
              'Final Inspection',
              'In-process Inspection',
              'Other',
            ])}
            {form.foundDuring === 'Other' &&
              field('Specify Other Activity', 'otherActivity')}
          </div>
        </div>

        {area(
          'PROBLEM DESCRIPTION (attach any supporting documents):',
          'problemDescription',
          5
        )}

        {area('IMMEDIATE ACTION TAKEN:', 'immediateAction', 4)}

        <div className="grid gap-4 sm:grid-cols-2">
          {field('Date of Occurrence', 'occurrenceDate', 'date')}
          {field('Signature', 'reportingSignature')}
          {field('Signature Date', 'reportingSignatureDate', 'date')}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="grid gap-3 sm:grid-cols-2">
          <h2 className="text-lg font-bold">SECTION 2: Production Manager</h2>
          <h2 className="text-lg font-bold">Document Controller</h2>
        </div>

        {choice('CRITICALITY LEVEL', 'criticalityLevel', [
          'High',
          'Medium / Moderate',
          'Low',
        ])}

        {area('RETESTING OF PRODUCT RESULT:', 'retestingResult', 3)}

        <div>
          <p className={labelClass}>DISPOSITION</p>
          {choice('Disposition', 'disposition', [
            'Use-as-is',
            'Rework',
            'Return to supplier',
            'Repair',
            'Reject',
            'Other',
          ])}
          {form.disposition === 'Other' && (
            <div className="mt-3">
              {field('Specify Other Disposition', 'otherDisposition')}
            </div>
          )}
        </div>

        {area('REQUIRED ACTION:', 'requiredAction', 4)}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {field('Owner', 'owner')}
          {field('Date Assigned', 'dateAssigned', 'date')}
          {field('Investigation Due Date', 'investigationDueDate', 'date')}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {field('Production Manager Signature', 'productionManagerSignature')}
          {field('Document Controller Signature', 'documentControllerSignature')}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-bold">
          SECTION 3: To be completed by Owner and returned to Production
          Manager for review prior to due date
        </h2>

        {choice('Approval of Corrective / Preventative Action', 'capaApproval', [
          'Yes',
          'No',
        ])}

        {field('CAPA & RCA Form No. Issued', 'capaRcaNumber')}

        <div className="grid gap-4 sm:grid-cols-3">
          {field('Name', 'ownerName')}
          {field('Date', 'ownerDate', 'date')}
          {field('Signature', 'ownerSignature')}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-bold">
          SECTION 4: Quality Designee or Other (Specify)
        </h2>

        {field('Quality Designee / Other (Specify)', 'qualityDesignee')}

        <h3 className="font-semibold">CLOSING THE NON-CONFORMANCE</h3>

        <p className="text-sm">
          Planned Disposition has been completed and Corrective Action has
          been initiated. Attach proof of completion where possible.
        </p>

        {choice(
          'Has the planned disposition been completed and corrective action initiated?',
          'dispositionCompleted',
          ['Yes', 'No']
        )}

        {form.dispositionCompleted === 'No' &&
          field('New NCR Number', 'newNcrNumber')}

        <div className="grid gap-4 sm:grid-cols-2">
          {field('Quality Designee Signature', 'qualitySignature')}
          {field('Date', 'qualityDate', 'date')}
        </div>
      </section>

      <div className="flex justify-end print:hidden">
        <Button
            onClick={saveRecord}
            disabled={saving || recordStatus !== 'draft'}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving
              ? 'Saving...'
              : recordStatus !== 'draft'
                ? 'Record Locked'
                : 'Save NCR'}
          </Button>      
      </div>
    </div>
  );
};

export default QualityNCRForm;
