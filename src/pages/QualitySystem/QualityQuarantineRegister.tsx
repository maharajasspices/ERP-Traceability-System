
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Printer, RefreshCw } from 'lucide-react';

interface QuarantineRecord {
  id: string;
  record_number: string | null;
  title: string | null;
  form_data: Record<string, any> | null;
  status: string;
  created_at: string;
}

interface QualityQuarantineRegisterProps {
  documentId: string;
}

const QualityQuarantineRegister: React.FC<QualityQuarantineRegisterProps> = ({
  documentId,
}) => {
  const [records, setRecords] = useState<QuarantineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const { data: formDocument, error: documentError } = await supabase
        .from('fms_quality_documents')
        .select('id')
        .eq('document_no', 'MSRQ2-FRM-2')
        .single();

      if (documentError) throw documentError;

      const { data, error } = await supabase
        .from('fms_quality_records')
        .select('id, record_number, title, form_data, status, created_at')
        .eq('document_id', formDocument.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords((data || []) as QuarantineRecord[]);
    } catch (error: any) {
      console.error('Error loading quarantine register:', error);

      toast({
        title: 'Unable to load quarantine register',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords, documentId]);

  const formatDate = (value?: string) => {
    if (!value) return '—';

    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-ZA');
  };

  const outcomeLabel = (value?: string) => {
    const labels: Record<string, string> = {
      'Return to Supplier': 'Return to supplier',
      'Accept on concession': 'Accepted on concession',
      'Return to stock': 'Returned to stock',
      'Sell on concession': 'Sold on concession',
      Rework: 'Rework',
      Scrap: 'Scrapped',
    };

    return value ? labels[value] || value : 'Pending';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Quarantine Register</h2>
          <p className="text-sm text-muted-foreground">
            {records.length} quarantine record(s)
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRecords} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="mb-6 border-b pb-5">
          <h1 className="text-center text-2xl font-bold uppercase tracking-wide">
            Quarantine Register
          </h1>

          <p className="mt-2 text-center text-sm font-semibold">
            MSRQ2-LOG-2
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <p>Issue Date: <strong>01/05/2026</strong></p>
            <p>Revision Date: <strong>N/A</strong></p>
            <p>Version No.: <strong>0</strong></p>
            <p>Compiled By: <strong>Tania Naicker</strong></p>
            <p>Approved By: <strong>Bradley Pillay</strong></p>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading quarantine records...
          </p>
        ) : records.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="font-medium">No quarantine records have been recorded yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Quarantine tags saved through MSRQ2-FRM-2 will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted">
                  {[
                    'No.',
                    'Date',
                    'Description of Material',
                    'Reason for Quarantine',
                    'Quantity Affected',
                    'Batch No.',
                    'Supplier Delivery Note No.',
                    'NCR No.',
                    'Outcome',
                    'Quantity per Outcome',
                    'Date Actioned',
                    'Comment',
                    'Authorised By',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border p-2 text-left font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {records.map((record, index) => {
                  const form = record.form_data || {};

                  return (
                    <tr key={record.id} className="align-top">
                      <td className="border p-2">{records.length - index}</td>
                      <td className="border p-2">
                        {formatDate(form.dateQuarantined)}
                      </td>
                      <td className="border p-2">{form.productDescription || '—'}</td>
                      <td className="border p-2">{form.reasonForQuarantine || '—'}</td>
                      <td className="border p-2">{form.quantity || '—'}</td>
                      <td className="border p-2">{form.batchNumber || '—'}</td>
                      <td className="border p-2">{form.deliveryNoteNumber || '—'}</td>
                      <td className="border p-2">{form.ncrNumber || '—'}</td>
                      <td className="border p-2">
                        {outcomeLabel(form.releaseDisposition)}
                      </td>
                      <td className="border p-2">
                        {form.quantityPerOutcome || '—'}
                      </td>
                      <td className="border p-2">
                        {formatDate(form.releaseDate)}
                      </td>
                      <td className="border p-2">
                        {form.comment || '—'}
                      </td>
                      <td className="border p-2">
                        {form.releaseSignature || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          Doc No.: MSRQ2-LOG-2 | Page 1 of 1 | Version No.: 0
          <p className="mt-2">
            Controlled document – Printed copies are uncontrolled unless otherwise authorised.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QualityQuarantineRegister;
