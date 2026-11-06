
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Printer, ArrowLeft } from 'lucide-react';

interface QualityNCRFormProps {
  documentId: string;
  recordId?: string;
}

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

type NCRFormData = typeof initialForm;

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';

const labelClass = 'mb-1 block text-sm font-medium';

const sectionClass =
  'space-y-5 rounded-lg border bg-card p-5 print:break-inside-avoid';

const QualityNCRForm = ({
  documentId,
  recordId,
}: QualityNCRFormProps) => {
  const navigate = useNavigate();
  const { user, fmsUser } = useFMSAuth();

  const [form, setForm] = useState<NCRFormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!recordId);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(
    recordId || null
  );
  const [status, setStatus] = useState('draft');

  const isAdmin = fmsUser?.role === 'system_admin';
  const isReadOnly = status === 'submitted' || status === 'closed';

  useEffect(() => {
    if (!recordId) {
      setForm(initialForm);
      setSavedRecordId(null);
      setStatus('draft');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('fms_quality_records')
          .select('id, document_id, form_data, status')
          .eq('id', recordId)
          .eq('document_id', documentId)
          .single();

        if (error) throw error;

        if (cancelled) return;

        setForm({
          ...initialForm,
          ...(data.form_data || {}),
        });

        setSavedRecordId(data.id);
        setStatus(data.status || 'draft');
      } catch (error: any) {
        console.error('Error loading NCR:', error);
        toast.error(error.message || 'Unable to load this NCR.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRecord();

    return () => {
      cancelled = true;
    };
  }, [recordId, documentId]);

  const update = (field: keyof NCRFormData, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const field = (
    label: string,
    name: keyof NCRFormData,
    type = 'text'
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        className={inputClass}
        value={form[name]}
        disabled={isReadOnly}
        onChange={(e) => update(name, e.target.value)}
      />
    </div>
  );

  const area = (
    label: string,
    name: keyof NCRFormData,
    rows = 4
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        rows={rows}
        className={inputClass}
        value={form[name]}
        disabled={isReadOnly}
        onChange={(e) => update(name, e.target.value)}
      />
    </div>
  );

  const choice = (
    label: string,
    name: keyof NCRFormData,
    options: string[]
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        className={inputClass}
        value={form[name]}
        disabled={isReadOnly}
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

  const validateForm = () => {
    if (!user?.id) {
      toast.error('You must be logged in to save an NCR.');
      return false;
    }

    if (!form.originatorName.trim() || !form.problemDescription.trim()) {
      toast.error(
        'Please enter the Originator Name and Problem Description.'
      );
      return false;
    }

    if (!form.ncrNumber.trim()) {
      toast.error('Please enter an NCR Number before saving.');
      return false;
    }

    return true;
  };

  const persistRecord = async (
    nextStatus: 'draft' | 'submitted'
  ) => {
    console.log('DOCUMENT ID BEING SAVED:', documentId);
console.log('DOCUMENT ID TYPE:', typeof documentId);

if (!documentId) {
  toast.error('Document ID is missing. Cannot save this NCR.');
  return;
}

if (!validateForm()) return;

setSaving(true);

    try {
      const recordData: Record<string, any> = {
        document_id: documentId,
        record_number: form.ncrNumber.trim(),
        title: `Non-Conformance Report ${form.ncrNumber.trim()}`,
        form_data: form,
        status: nextStatus,
        updated_by: user!.id,
        ...(nextStatus === 'submitted'
          ? { submitted_at: new Date().toISOString() }
          : {}),
      };

      let savedId = savedRecordId;

      if (savedRecordId) {
        let updateQuery = supabase
          .from('fms_quality_records')
          .update(recordData)
          .eq('id', savedRecordId)
          .eq('document_id', documentId);

        // Quality users can update their own records.
        // System administrators can update records belonging to others.
        if (!isAdmin) {
          updateQuery = updateQuery.eq('created_by', user!.id);
        }

        const { data, error } = await updateQuery
          .select('id')
          .single();

        if (error) throw error;

        savedId = data.id;
      } else {
        const { data, error } = await supabase
          .from('fms_quality_records')
          .insert({
            ...recordData,
            created_by: user!.id,
          })
          .select('id')
          .single();

        if (error) throw error;

        savedId = data.id;
      }

      setSavedRecordId(savedId);
      setStatus(nextStatus);

      if (nextStatus === 'submitted') {
        toast.success('NCR submitted successfully.');
      } else {
        toast.success('NCR draft saved successfully.');
      }
    } catch (error: any) {
      console.error('Error saving NCR:', error);
      toast.error(
        error.message || 'Unable to save the NCR. Check your permissions.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading NCR record...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">
            Non-Conformance Report Form
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete the relevant sections and save or submit the report.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {recordId && (
            <Button
              variant="outline"
              onClick={() =>
                navigate('/quality-system/documents/MSRQ2-LOG-1')
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Logbook
            </Button>
          )}

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>

          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={() => persistRecord('draft')}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>

              <Button
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to submit this NCR? Submitted reports will become read-only.'
                    )
                  ) {
                    persistRecord('submitted');
                  }
                }}
                disabled={saving}
              >
                {saving ? 'Processing...' : 'Submit NCR'}
              </Button>
            </>
          )}
        </div>
      </div>

      {savedRecordId && (
        <div className="rounded-lg border p-3 text-sm">
          <strong>Record status:</strong>{' '}
          <span className="capitalize">{status}</span>
          {status === 'submitted' &&
            ' – This report has been submitted and is read-only.'}
        </div>
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
          <h2 className="text-lg font-bold">
            SECTION 2: Production Manager
          </h2>
          <h2 className="text-lg font-bold">
            Document Controller
          </h2>
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

        {choice(
          'Approval of Corrective / Preventative Action',
          'capaApproval',
          ['Yes', 'No']
        )}

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

        <h3 className="font-semibold">
          CLOSING THE NON-CONFORMANCE
        </h3>

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

      {!isReadOnly && (
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button
            variant="outline"
            onClick={() => persistRecord('draft')}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>

          <Button
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to submit this NCR? Submitted reports will become read-only.'
                )
              ) {
                persistRecord('submitted');
              }
            }}
            disabled={saving}
          >
            {saving ? 'Processing...' : 'Submit NCR'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default QualityNCRForm;
