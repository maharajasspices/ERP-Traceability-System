
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, RefreshCw, Eye, Search } from 'lucide-react';

interface NCRRecord {
  id: string;
  record_number: string | null;
  title: string;
  form_data: Record<string, any>;
  status: string;
  created_at: string;
}

interface QualityNCRLogbookProps {
  documentId: string;
}

const QualityNCRLogbook = ({ documentId }: QualityNCRLogbookProps) => {
  const navigate = useNavigate();

  const [records, setRecords] = useState<NCRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadRecords = async () => {
    setLoading(true);

    try {
      const { data: ncrDocument, error: documentError } = await supabase
        .from('fms_quality_documents')
        .select('id')
        .eq('document_no', 'MSRQ2-FRM-1')
        .single();

      if (documentError) throw documentError;

      const { data, error } = await supabase
        .from('fms_quality_records')
        .select('id, record_number, title, form_data, status, created_at')
        .eq('document_id', ncrDocument.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords((data || []) as NCRRecord[]);
    } catch (error: any) {
      console.error('Error loading NCR logbook:', error);
      toast.error(error.message || 'Unable to load the NCR logbook.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [documentId]);

  const formatDate = (date: string) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-ZA');
  };

  const getActivity = (form: Record<string, any>) => {
    if (form.foundDuring === 'Other') {
      return form.otherActivity || 'Other';
    }

    return form.foundDuring || '—';
  };

  const filteredRecords = records.filter((record) => {
    const form = record.form_data || {};
    const term = search.toLowerCase();

    return (
      (form.ncrNumber || record.record_number || '')
        .toLowerCase()
        .includes(term) ||
      (form.originatorName || '').toLowerCase().includes(term) ||
      (form.productDescription || '').toLowerCase().includes(term) ||
      (form.problemDescription || '').toLowerCase().includes(term)
    );
  });

  const openRecord = (recordId: string) => {
    navigate(
      `/quality-system/documents/MSRQ2-FRM-1?recordId=${encodeURIComponent(recordId)}`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">
            Non-Conformance Report Logbook
          </h2>
          <p className="text-sm text-muted-foreground">
            Register of non-conformance reports recorded in the Quality System.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRecords}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h1 className="mb-5 text-center text-2xl font-bold">
          Non-Conformance Report Logbook
        </h1>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Doc No.</p>
            <p className="font-semibold">MSRQ2-LOG-1</p>
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
            <p className="text-xs text-muted-foreground">Revision Date</p>
            <p className="font-semibold">N/A</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Compiled By</p>
            <p className="font-semibold">Tania Naicker</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Authorised By</p>
            <p className="font-semibold">Bradley Pillay</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">NCR Register</h3>
            <p className="text-sm text-muted-foreground">
              {filteredRecords.length} of {records.length} record(s)
            </p>
          </div>

          <div className="relative w-full sm:w-72 print:hidden">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search NCR number, name or product..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-muted-foreground">
            Loading NCR records...
          </p>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">
              {records.length === 0
                ? 'No NCR records have been recorded yet.'
                : 'No matching NCR records found.'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved reports through MSRQ2-FRM-1 will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1350px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  {[
                    'Date',
                    'NCR No.',
                    'Originator',
                    'Found During',
                    'Criticality',
                    'Detail of Concern',
                    'Action Taken',
                    'Status',
                    'Sign',
                    'Action',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border p-3 text-left font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => {
                  const form = record.form_data || {};

                  return (
                    <tr key={record.id} className="align-top">
                      <td className="border p-3">
                        {formatDate(
                          form.occurrenceDate || record.created_at
                        )}
                      </td>

                      <td className="border p-3 font-medium">
                        {form.ncrNumber || record.record_number || '—'}
                      </td>

                      <td className="border p-3">
                        {form.originatorName || '—'}
                      </td>

                      <td className="border p-3">
                        {getActivity(form)}
                      </td>

                      <td className="border p-3">
                        {form.criticalityLevel || '—'}
                      </td>

                      <td className="max-w-[280px] whitespace-pre-wrap border p-3">
                        {form.problemDescription || '—'}
                      </td>

                      <td className="max-w-[250px] whitespace-pre-wrap border p-3">
                        {form.immediateAction || '—'}
                      </td>

                      <td className="border p-3">
                        <Badge
                          variant={
                            record.status === 'submitted'
                              ? 'default'
                              : record.status === 'closed'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {record.status || 'draft'}
                        </Badge>
                      </td>

                      <td className="border p-3">
                        {form.reportingSignature || '—'}
                      </td>

                      <td className="border p-3 print:hidden">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRecord(record.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        This register displays reports saved through the Non-Conformance
        Report Form. Open a draft to continue editing or a submitted report
        to view and print it.
      </p>
    </div>
  );
};

export default QualityNCRLogbook;
