import React, { useMemo, useRef, useState } from 'react';
import { useHRData, HRDocument } from '@/hooks/useHRData';
import { FileText, FileCheck, FileX, Loader2, Search, Download, Upload, Trash2, CheckCircle2, XCircle, Send, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase} from '@/integrations/supabase/client'

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'warning', label: 'Warning' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'other', label: 'Other' },
];

const typeStyles: Record<string, string> = {
  contract: 'bg-success/10 text-success border-success/30',
  id_document: 'bg-info/10 text-info border-info/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  qualification: 'bg-muted text-muted-foreground border-border',
  other: 'bg-muted text-muted-foreground border-border',
};

const Documents: React.FC = () => {
  const { documents, employees, contractSignatures, loading, uploadingDocument, uploadDocument, deleteDocument, sendContractForSignature } = useHRData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState('');
  const [uploadDocType, setUploadDocType] = useState('contract');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [sendingSignatureId, setSendingSignatureId] = useState<string | null>(null);

  const employeeMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string; contract_signed: boolean; contract_signed_date?: string }>();
    employees.forEach((e) => map.set(e.id, { first_name: e.first_name, last_name: e.last_name, contract_signed: e.contract_signed, contract_signed_date: e.contract_signed_date }));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const emp = employeeMap.get(d.employee_id);
      const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
      const matchesSearch = !search || name.includes(search.toLowerCase()) || d.document_name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || d.document_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, employeeMap, search, typeFilter]);

  const contractCount = documents.filter((d) => d.document_type === 'contract').length;
  const idCount = documents.filter((d) => d.document_type === 'id_document').length;
  const warningCount = documents.filter((d) => d.document_type === 'warning').length;
  const signedContracts = employees.filter((e) => e.contract_signed).length;
  const unsignedContracts = employees.filter((e) => !e.contract_signed).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!uploadEmployeeId) {
      toast.error('Please select an employee.');
      return;
    }
    if (!uploadFile) {
      toast.error('Please select a file to upload.');
      return;
    }
    const result = await uploadDocument(uploadEmployeeId, uploadFile, uploadDocType);
    if (result) {
      setShowUpload(false);
      setUploadEmployeeId('');
      setUploadDocType('contract');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const doc = documents.find((d) => d.id === deleteTarget);
    if (doc) await deleteDocument(doc);
    setDeleteTarget(null);
  };

  // Send a contract document to its employee for electronic signature.
  const handleSendForSignature = async (doc: HRDocument) => {
    if (!doc.employee_id) {
      toast.error('This document is not linked to an employee.');
      return;
    }
    setSendingSignatureId(doc.id);
    try {
      await sendContractForSignature(doc.employee_id, doc.id);
    } finally {
      setSendingSignatureId(null);
    }
  };

  // The latest pending signing request for a given contract document.
  const getDocumentSignature = (documentId?: string) => {
    if (!documentId) return undefined;
    return contractSignatures
      .filter((s) => s.document_id === documentId)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{documents.length}</p>
              <p className="text-xs text-muted-foreground">Total documents</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{contractCount}</p>
              <p className="text-xs text-muted-foreground">Contracts</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{idCount}</p>
              <p className="text-xs text-muted-foreground">ID Documents</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <FileX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Signed Status */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-3 font-semibold text-foreground">Contract Status</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">{signedContracts} employees with signed contracts</p>
              <p className="text-xs text-muted-foreground">Contract signed & on file</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <XCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">{unsignedContracts} employees without signed contracts</p>
              <p className="text-xs text-muted-foreground">Contract not yet signed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by employee or document name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">All Types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <Button onClick={() => setShowUpload(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Contract Signed</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No documents found. Click "Upload Document" to add one.
                  </td>
                </tr>
              )}
              {filtered.map((d) => {
                const emp = employeeMap.get(d.employee_id);
                return (
                  <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.document_name}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", typeStyles[d.document_type] || 'bg-muted text-muted-foreground border-border')}>
                        {DOCUMENT_TYPES.find((t) => t.value === d.document_type)?.label || d.document_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.document_type === 'contract' ? (
                        emp?.contract_signed ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Signed{emp.contract_signed_date ? ` ${emp.contract_signed_date}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                            <XCircle className="h-3 w-3" />
                            Not Signed
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={d.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5" />
                          View
                        </a>
                        {d.document_type === 'contract' && d.employee_id && (
                          (() => {
                            const docSig = getDocumentSignature(d.id);
                            if (docSig && docSig.status === 'signed') {
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                                  title={`Signed ${docSig.signed_at ? new Date(docSig.signed_at).toLocaleDateString() : ''}`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Signed
                                </span>
                              );
                            }
                            if (docSig && docSig.status === 'pending') {
                              return (
                                <button
                                  onClick={() => handleSendForSignature(d)}
                                  disabled={sendingSignatureId === d.id}
                                  title="Resend the signing request (a new secure link is created)"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                                >
                                  {sendingSignatureId === d.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  Resend
                                </button>
                              );
                            }
                            return (
                              <button
                                onClick={() => handleSendForSignature(d)}
                                disabled={sendingSignatureId === d.id}
                                title="Email this contract to the employee for electronic signature"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                              >
                                {sendingSignatureId === d.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <PenLine className="h-3.5 w-3.5" />
                                )}
                                {sendingSignatureId === d.id ? 'Sending...' : 'Send for Signature'}
                              </button>
                            );
                          })()
                        )}
                        <button
                          onClick={() => setDeleteTarget(d.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Attach a document to an employee's record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-employee">Employee</Label>
              <select
                id="doc-employee"
                value={uploadEmployeeId}
                onChange={(e) => setUploadEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select employee...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.employee_number || 'No #'})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type</Label>
              <select
                id="doc-type"
                value={uploadDocType}
                onChange={(e) => setUploadDocType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">File</Label>
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploadingDocument} className="bg-emerald-600 hover:bg-emerald-700">
              {uploadingDocument ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;