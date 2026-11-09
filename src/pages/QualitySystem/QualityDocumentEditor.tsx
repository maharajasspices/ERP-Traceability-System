
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Printer,
  Edit3,
  History,
  ShieldCheck,
} from 'lucide-react';

import QualityNCRForm from './QualityNCRForm';
import QualityNCRLogbook from './QualityNCRLogbook';
import QualityQuarantineTag from './QualityQuarantineTag';
import QualityQuarantineRegister from './QualityQuarantineRegister';
import QualityConcessionForm from './QualityConcessionForm';
import QualityConcessionRegister from './QualityConcessionRegister';

interface QualityDocument {
  id: string;
  document_no: string;
  title: string;
  category: string;
  document_type: string;
  version_no: number;
  issue_date: string | null;
  revision_date: string | null;
  compiled_by: string | null;
  approved_by: string | null;
  content: string | null;
  status: string;
}

interface QualityRevision {
  id: string;
  version_no: number;
  title: string;
  created_at: string;
  compiled_by: string | null;
  change_summary: string | null;
}

const customForms: Record<string, React.ComponentType<any>> = {
  'MSRQ2-FRM-1': QualityNCRForm,
  'MSRQ2-LOG-1': QualityNCRLogbook,
  'MSRQ2-FRM-2': QualityQuarantineTag,
  'MSRQ2-LOG-2': QualityQuarantineRegister,
  'MSRQ2-FRM-3': QualityConcessionForm,
  'MSRQ2-LOG-3': QualityConcessionRegister,
};

const displayDate = (date: string | null) => {
  if (!date) return 'N/A';

  return new Date(date).toLocaleDateString('en-ZA');
};

const QualityDocumentEditor = () => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get('recordId');

  const { user, fmsUser } = useFMSAuth();
  const isAdmin = fmsUser?.role === 'system_admin';

  const [document, setDocument] = useState<QualityDocument | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<QualityRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [versionNo, setVersionNo] = useState(0);
  const [issueDate, setIssueDate] = useState('');
  const [revisionDate, setRevisionDate] = useState('');
  const [compiledBy, setCompiledBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [content, setContent] = useState('');

  const loadDocument = async () => {
    if (!documentId) {
      toast.error('Document number is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const documentNumber = decodeURIComponent(documentId);

const isUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    documentNumber
  );

const { data, error } = isUuid
  ? await supabase
      .from('fms_quality_documents')
      .select('*')
      .eq('id', documentNumber)
      .single()
  : await supabase
      .from('fms_quality_documents')
      .select('*')
      .eq('document_no', documentNumber)
      .single();

      if (error) throw error;

      setDocument(data);

      setTitle(data.title || '');
      setVersionNo(Number(data.version_no) || 0);
      setIssueDate(data.issue_date || '');
      setRevisionDate(data.revision_date || '');
      setCompiledBy(data.compiled_by || '');
      setApprovedBy(data.approved_by || '');
      setContent(data.content || '');

      const { data: revisions, error: revisionError } = await supabase
        .from('fms_quality_document_revisions')
        .select('*')
        .eq('document_id', data.id)
        .order('created_at', { ascending: false });

      if (revisionError) throw revisionError;

      setRevisionHistory(revisions || []);
    } catch (error: any) {
      console.error('Error loading Quality document:', error);
      toast.error(error.message || 'Unable to load this document.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const cancelEditing = () => {
    if (!document) return;

    setTitle(document.title || '');
    setVersionNo(Number(document.version_no) || 0);
    setIssueDate(document.issue_date || '');
    setRevisionDate(document.revision_date || '');
    setCompiledBy(document.compiled_by || '');
    setApprovedBy(document.approved_by || '');
    setContent(document.content || '');

    setEditing(false);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Only system administrators can edit master documents.');
      return;
    }

    if (!user?.id || !document) {
      toast.error('Document or user information is missing.');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a document title.');
      return;
    }

    setSaving(true);

    try {
      // Archive the current version before updating the master.
      const { error: revisionError } = await supabase
        .from('fms_quality_document_revisions')
        .insert({
          document_id: document.id,
          version_no: document.version_no,
          title: document.title,
          content: document.content,
          issue_date: document.issue_date,
          revision_date: document.revision_date,
          compiled_by: document.compiled_by,
          approved_by: document.approved_by,
          change_summary: 'Previous version archived before master document update.',
          changed_by: user.id,
        });

      if (revisionError) throw revisionError;

      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('fms_quality_documents')
        .update({
          title: title.trim(),
          version_no: String(
            Math.max(Number(document.version_no) || 0, versionNo) + 1
          ),
          issue_date: issueDate || null,
          revision_date: today,
          compiled_by: compiledBy,
          approved_by: approvedBy,
          content,
          updated_by: user.id,
        })
        .eq('id', document.id)
        .select('*')
        .single();

      if (error) throw error;

      setDocument(data);
      setVersionNo(Number(data.version_no) || 0);
      setRevisionDate(data.revision_date || '');
      setEditing(false);

      toast.success('Master document updated successfully.');

      await loadDocument();
    } catch (error: any) {
      console.error('Error saving Quality document:', error);
      toast.error(error.message || 'Unable to save the master document.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Loading Quality document...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="space-y-4 p-8">
        <Button variant="outline" onClick={() => navigate('/quality-system/documents')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>
        <p className="text-destructive">The requested document could not be found.</p>
      </div>
    );
  }

  const CustomForm = customForms[document.document_no];

  return (
    <div className="space-y-6 p-8 sm:p-12 md:p-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/quality-system/documents')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>

        <Badge variant="secondary">{document.status}</Badge>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/images/mslogo.png"
              alt="Maharaja's Spices"
              className="h-16 w-auto object-contain"
            />

            <div>
              <h1 className="text-2xl font-bold">{document.title}</h1>
              <p className="text-sm text-muted-foreground">
                Maharaja's Spices Quality Management System
              </p>
              <p className="mt-1 text-sm font-semibold">
                {document.document_no}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>

            {isAdmin && !editing && (
              <Button onClick={() => setEditing(true)}>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Master
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Issue Date</p>
            <p className="font-medium">{displayDate(document.issue_date)}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Version Number</p>
            <p className="font-medium">{document.version_no}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Revision Date</p>
            <p className="font-medium">{displayDate(document.revision_date)}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Compiled By</p>
            <p className="font-medium">{document.compiled_by || 'N/A'}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Approved By</p>
            <p className="font-medium">{document.approved_by || 'N/A'}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="font-medium">{document.category || 'N/A'}</p>
          </div>
        </div>
      </div>

      {editing && isAdmin ? (
        <div className="space-y-5 rounded-lg border bg-card p-6 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Edit Master Document</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Document Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Version Number</label>
              <Input
                type="number"
                value={versionNo}
                onChange={(e) => setVersionNo(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Issue Date</label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Compiled By</label>
              <Input value={compiledBy} onChange={(e) => setCompiledBy(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Approved By</label>
              <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Document Content</label>
            <Textarea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Master Document'}
            </Button>
          </div>
        </div>
      ) : CustomForm ? (
        <CustomForm
          documentId={document.id}
          {...(document.document_no === 'MSRQ2-FRM-1' && recordId
            ? { recordId }
            : {})}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">{document.title}</h2>
          <div className="whitespace-pre-wrap leading-7">
            {document.content || 'No document content has been added yet.'}
          </div>
        </div>
      )}

      {revisionHistory.length > 0 && (
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Revision History</h2>
          </div>

          {revisionHistory.map((revision) => (
            <div
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3"
            >
              <div>
                <p className="font-medium">
                  Version {revision.version_no} – {revision.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Archived: {displayDate(revision.created_at)}
                  {revision.compiled_by
                    ? ` · Compiled by ${revision.compiled_by}`
                    : ''}
                </p>
                {revision.change_summary && (
                  <p className="mt-1 text-sm">{revision.change_summary}</p>
                )}
              </div>

              <Badge variant="outline">Archived</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QualityDocumentEditor;
