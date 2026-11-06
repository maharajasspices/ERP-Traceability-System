
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Printer, RefreshCw } from 'lucide-react';

interface ConcessionRecord {
  id: string;
  document_id: string;
  record_number: string | null;
  title: string;
  form_data: Record<string, string>;
  status: string;
  created_at: string;
}

interface QualityConcessionRegisterProps {
  documentId: string;
}

const QualityConcessionRegister = ({
  documentId,
}: QualityConcessionRegisterProps) => {
  const [records, setRecords] = useState<ConcessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] =
    useState<ConcessionRecord | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('fms_quality_records')
        .select(
          'id, document_id, record_number, title, form_data, status, created_at'
        )
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords((data || []) as ConcessionRecord[]);
    } catch (error: any) {
      console.error('Error loading concession records:', error);
      toast.error(error.message || 'Could not load concession records.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filteredRecords = records.filter((record) => {
    const searchText = search.toLowerCase();

    return (
      (record.record_number || '').toLowerCase().includes(searchText) ||
      (record.title || '').toLowerCase().includes(searchText) ||
      (record.form_data?.productDescription || '')
        .toLowerCase()
        .includes(searchText)
    );
  });

  const displayValue = (value?: string) =>
    value?.trim() ? value : 'Not provided';

  const printRecord = () => {
    window.print();
  };

  if (selectedRecord) {
    const data = selectedRecord.form_data || {};

    const details = [
      ['Date', data.date],
      ['Concession Number', data.concessionNumber],
      ['Product Description', data.productDescription],
      ['Reason for Concession', data.reasonForConcession],
      ['Name of Person Requesting Concession', data.requestingPerson],
      ['Requester Signature', data.requesterSignature],
      ['Concession Accepted', data.accepted],
      ['Price', data.price],
      ['Delivery Note No.', data.deliveryNoteNumber],
      ['Invoice No.', data.invoiceNumber],
      ['NCR No.', data.ncrNumber],
      ['Reason for Accepting / Not Accepting', data.decisionReason],
      ['Company Name', data.companyName],
      ['Contact Person', data.contactPerson],
      ['Address', data.address],
      ['Accepting Person Signature', data.acceptingSignature],
      ['Acceptance Date', data.acceptanceDate],
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button
            variant="outline"
            onClick={() => setSelectedRecord(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Register
          </Button>

          <Button variant="outline" onClick={printRecord}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Download PDF
          </Button>
        </div>

        <div className="rounded-lg border bg-white p-5 text-black sm:p-8">
          <div className="mb-6 border-b pb-5 text-center">
            <h1 className="text-2xl font-bold uppercase">
              Concession Record
            </h1>
            <p className="mt-2 text-sm">Doc No.: MSRQ2-FRM-3</p>
            <p className="mt-2 text-sm font-semibold">
              Record No.: {displayValue(selectedRecord.record_number || '')}
            </p>
            <Badge variant="outline" className="mt-3 print:hidden">
              {selectedRecord.status}
            </Badge>
          </div>

          <div className="space-y-4">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-1 gap-1 border-b pb-3 sm:grid-cols-[240px_1fr]"
              >
                <p className="text-sm font-semibold">{label}</p>
                <p className="whitespace-pre-wrap text-sm">
                  {displayValue(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t pt-3 text-center text-xs text-gray-500">
            Maharaja's Spices – Controlled Quality Record
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Concession Records Register
          </h2>
          <p className="text-sm text-muted-foreground">
            Saved records linked to MSRQ2-FRM-3.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadRecords}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by record number or product..."
          className="max-w-md"
        />
        <p className="text-sm text-muted-foreground">
          {filteredRecords.length} record(s)
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading concession records...
        </p>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No concession records found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a completed concession form to see it listed here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3">Record No.</th>
                <th className="p-3">Product Description</th>
                <th className="p-3">Date Created</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="p-3 font-medium">
                    {record.record_number || 'Not numbered'}
                  </td>
                  <td className="max-w-xs p-3">
                    <span className="line-clamp-2">
                      {record.form_data?.productDescription ||
                        'Not provided'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {new Date(record.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{record.status}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QualityConcessionRegister;
