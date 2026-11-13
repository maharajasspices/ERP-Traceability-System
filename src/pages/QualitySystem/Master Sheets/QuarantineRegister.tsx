import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFMSAuth } from "@/context/FMSAuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Grid } from "lucide-react";

interface QuarantineRegisterEntry {
  id: string;
  record_number: string;
  title: string;
  form_data: {
    dateQuarantined: string;
    tagNumber: string;
    productDescription: string;
    reasonForQuarantine: string;
    customerName: string;
    supplierName: string;
    quantityInQuarantine: string;
    batchNumber: string;
    deliveryNoteNumber: string;
    ncrNumber: string;
    name: string;
    signature: string;
    factory: string;
    submitted_at: string;
  };
  status: string;
}

export default function QuarantineRegister({ factory }: { factory: "rockwood" | "nguni" }) {
  const { fmsUser } = useFMSAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<QuarantineRegisterEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
      .from("fms_quality_records").select("*");

      if (factory) {
        query = query.eq("factory", factory);
      }

      // Filter by form type if needed - quarantine tags have template_key "quarantine-tag"
      const { data, error } = await query
        .eq("template_key", "quarantine-tag")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setEntries(data as QuarantineRegisterEntry[]);
    } catch (error: any) {
      toast.error(error.message || "Failed to load quarantine register");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordNumber: string) => {
    if (!confirm(`Are you sure you want to delete record ${recordNumber}?`)) return;
    try {
      const { error } = await supabase
        .from("fms_quality_records")
        .delete()
        .eq("record_number", recordNumber);

      if (error) throw error;
      fetchEntries();
      toast.success("Record deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete record");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Quarantine Register - {factory}
        </h1>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Quarantine Records</h2>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
                <p>Loading records...</p>
              </div>
            )}

            {entries.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <h3>No quarantine records yet</h3>
                <p>
                  Quarantine tags will appear here as they are submitted.
                </p>
              </div>
            )}

            {entries.length > 0 && (
              <div className="space-y-3">
                {entries
                  .filter((entry) =>
                    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entry.record_number.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 bg-white rounded-lg border border-gray-200 hover:border-primary/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">
                          {entry.title} - {entry.record_number}
                        </h3>
                        <span className="text-sm text-gray-400">
                          {new Date(entry.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Tag No: {entry.form_data.tagNumber} | {entry.form_data.productDescription}
                      </p>
                      <p className="text-xs text-gray-400">
                        Quarantined: {entry.form_data.dateQuarantined} | {entry.form_data.quantityInQuarantine}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.print()}
                        >
                          Print
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(entry.record_number)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-gray-500">
          <p>Showing {entries.length} quarantine record(s)</p>
        </div>
      </div>
    </div>
  );
}