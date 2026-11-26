import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QualityMasterSheets from "./QualityMasterSheets";
import "./quality-system.css";
import { useLocation } from "react-router-dom";

type Factory = "Rockwood" | "Nguni" | "";

type ObsoleteEntry = {
  id: number;
  factory: Factory;
  documentNumber: string;
  documentName: string;
  versionNumber: string;
  date: string;
  storage: string;
  retentionTime: string;
  protection: string;
  disposition: string;
};

type SavedObsoleteEntry = {
  id: number;
  record_number: string;
  factory: string;
  form_data: Record<string, any>;
  created_at: string;
};

const createEmptyEntry = (id: number): ObsoleteEntry => ({
  id,
  factory: "",
  documentNumber: "",
  documentName: "",
  versionNumber: "",
  date: "",
  storage: "",
  retentionTime: "",
  protection: "",
  disposition: "",
});

function ObsoleteDocumentList() {
  const [entries, setEntries] = useState<ObsoleteEntry[]>([
    createEmptyEntry(1),
  ]);
  const [nextId, setNextId] = useState(2);
  const [savedEntries, setSavedEntries] = useState<SavedObsoleteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [searchTerm, setSearchTerm] = useState("");

  const loadSavedEntries = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_records")
        .select("*")
        .eq("title", "Obsolete Document List")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading obsolete documents:", error);
        alert("Could not load obsolete documents: " + error.message);
        return;
      }

      setSavedEntries(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedEntries();
  }, []);

  const updateEntry = (
    id: number,
    field: keyof ObsoleteEntry,
    value: string,
  ) => {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const saveEntry = async (entry: ObsoleteEntry) => {
    if (savingId !== null) return;

    if (!entry.factory) {
      alert("Please select a factory: Rockwood or Nguni.");
      return;
    }

    if (!entry.documentNumber.trim() || !entry.documentName.trim()) {
      alert("Please complete the required fields: Document Number and Document Name.");
      return;
    }

    setSavingId(entry.id);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this entry.");
        return;
      }

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Obsolete Document List",
          record_number: `ODL-${Date.now()}`,
          factory: entry.factory.toLowerCase(),
          form_data: {
            factory: entry.factory,
            documentNumber: entry.documentNumber.trim(),
            documentName: entry.documentName.trim(),
            versionNumber: entry.versionNumber,
            date: entry.date,
            storage: entry.storage,
            retentionTime: entry.retentionTime,
            protection: entry.protection,
            disposition: entry.disposition,
          },
          status: "submitted",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Obsolete document save error:", error);
        alert("Could not save entry: " + error.message);
        return;
      }

      alert("Obsolete document entry saved successfully!");

      setEntries((previous) =>
        previous.map((item) =>
          item.id === entry.id ? createEmptyEntry(item.id) : item,
        ),
      );

      await loadSavedEntries();
    } catch (error) {
      console.error("Unexpected save error:", error);
      alert("An unexpected error occurred while saving.");
    } finally {
      setSavingId(null);
    }
  };

  const addRow = () => {
    setEntries((previous) => [
      ...previous,
      createEmptyEntry(nextId),
    ]);
    setNextId((previous) => previous + 1);
  };

  const removeRow = (id: number) => {
    if (entries.length === 1) {
      alert("You must keep at least one entry row.");
      return;
    }

    setEntries((previous) =>
      previous.filter((entry) => entry.id !== id),
    );
  };

  const visibleSavedEntries = savedEntries.filter((entry) => {
    const data = entry.form_data || {};

    const searchText = [
      entry.factory,
      data.factory,
      data.documentNumber,
      data.documentName,
      data.versionNumber,
      data.storage,
      data.disposition,
      entry.record_number,
    ]
      .join(" ")
      .toLowerCase();

    return searchText.includes(searchTerm.toLowerCase());
  });

  const displayFactory = (record: SavedObsoleteEntry) => {
    const value = record.factory || record.form_data?.factory || "";
    if (value.toLowerCase() === "rockwood") return "Rockwood";
    if (value.toLowerCase() === "nguni") return "Nguni";
    return "Not selected";
  };

  const cellInput = (
    value: string,
    onChange: (value: string) => void,
    type = "text",
    placeholder = "",
  ) => (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="distribution-input"
    />
  );

  return (
    <div className="quality-register-page">
      <div className="register-topbar">
        <div className="register-heading">
          <h1>Document Control</h1>
          <p>Quality Management System · MS Q001 LOG 3</p>
        </div>

        <div className="register-actions">
          {activeView === "new" && (
            <>
              <button
                type="button"
                className="register-btn primary"
                onClick={addRow}
              >
                + Add Row
              </button>

              <button
                type="button"
                className="register-btn"
                onClick={() => window.print()}
              >
                Print Register
              </button>
            </>
          )}

          {activeView === "master" && (
            <button
              type="button"
              className="register-btn"
              onClick={loadSavedEntries}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "↻ Refresh Records"}
            </button>
          )}
        </div>
      </div>

      <div className="register-tabs">
        <button
          type="button"
          className={`register-tab ${activeView === "new" ? "active" : ""}`}
          onClick={() => setActiveView("new")}
        >
          New Obsolete Document Entry
        </button>

        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => setActiveView("master")}
        >
          Master Obsolete Document Register ({savedEntries.length})
        </button>
      </div>

      {activeView === "new" ? (
        <div className="register-paper">
          <div className="document-sheet">
            <div className="paper-heading">
              <div>
                <h2>Obsolete Document Record</h2>
                <p>
                  Record obsolete controlled documents and their
                  storage, retention and final disposition.
                </p>
              </div>

              <span className="record-count">
                {entries.length} {entries.length === 1 ? "entry row" : "entry rows"}
              </span>
            </div>

            <div className="document-header">
              <div className="logo-cell">
                <img
                  src="/images/mslogo.png"
                  alt="Maharaja's Spices"
                />
              </div>

              <div className="document-title">
                <strong>
                  OBSOLETE
                  <br />
                  DOCUMENT LIST
                </strong>
                <span>Quality Management System</span>
              </div>

              <div className="document-details">
                <div className="detail-row">
                  <div className="detail-label">Doc. No.:</div>
                  <div className="detail-value">MS Q001 LOG 3</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Issue Date:</div>
                  <div className="detail-value">03/07/2023</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Version No.:</div>
                  <div className="detail-value">3</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Revision Date:</div>
                  <div className="detail-value">06/06/2025</div>
                </div>
              </div>
            </div>

            <div className="table-section-heading">
              <h3>Obsolete Document Entries</h3>
              <span>Required fields: Factory, Document Number and Document Name</span>
            </div>

            <div className="table-scroll">
              <table className="register-table">
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Document Number</th>
                    <th>Document Name</th>
                    <th>Version Number</th>
                    <th>Date</th>
                    <th>Storage</th>
                    <th>Retention Time</th>
                    <th>Protection</th>
                    <th>Disposition of Document</th>
                    <th className="no-print">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <select
                          value={entry.factory}
                          onChange={(event) =>
                            updateEntry(entry.id, "factory", event.target.value)
                          }
                          className="distribution-input"
                          required
                        >
                          <option value="">Select factory</option>
                          <option value="Rockwood">Rockwood</option>
                          <option value="Nguni">Nguni</option>
                        </select>
                      </td>

                      <td>
                        {cellInput(
                          entry.documentNumber,
                          (value) =>
                            updateEntry(entry.id, "documentNumber", value),
                          "text",
                          "Document No.",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.documentName,
                          (value) =>
                            updateEntry(entry.id, "documentName", value),
                          "text",
                          "Document Name",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.versionNumber,
                          (value) =>
                            updateEntry(entry.id, "versionNumber", value),
                          "text",
                          "Version",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.date,
                          (value) =>
                            updateEntry(entry.id, "date", value),
                          "date",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.storage,
                          (value) =>
                            updateEntry(entry.id, "storage", value),
                          "text",
                          "Storage",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.retentionTime,
                          (value) =>
                            updateEntry(entry.id, "retentionTime", value),
                          "text",
                          "Retention",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.protection,
                          (value) =>
                            updateEntry(entry.id, "protection", value),
                          "text",
                          "Protection",
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.disposition,
                          (value) =>
                            updateEntry(entry.id, "disposition", value),
                          "text",
                          "Disposition",
                        )}
                      </td>

                      <td className="no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="save-row-btn"
                            disabled={savingId !== null}
                            onClick={() => saveEntry(entry)}
                          >
                            {savingId === entry.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            className="remove-row-btn"
                            disabled={savingId === entry.id}
                            onClick={() => removeRow(entry.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="add-row-area no-print">
              <button
                type="button"
                className="add-row-btn"
                onClick={addRow}
              >
                + Add Another Entry Row
              </button>
            </div>

            <div className="document-footer">
              <span>Doc. No.: MS Q001 LOG 3</span>
              <span>Controlled Quality Document</span>
              <span>Version No.: 3</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="register-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Obsolete Document Register</h2>
              <p>
                All obsolete document records saved in the Quality System.
              </p>
            </div>

            <span className="record-count">
              {visibleSavedEntries.length} records
            </span>
          </div>

          <div className="register-filters" style={{ marginBottom: 20 }}>
            <input
              className="register-search"
              placeholder="Search factory, document number or name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty-state">
              Loading saved obsolete document records...
            </div>
          ) : visibleSavedEntries.length === 0 ? (
            <div className="empty-state">
              No matching obsolete document entries found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Document Number</th>
                    <th>Document Name</th>
                    <th>Version Number</th>
                    <th>Date</th>
                    <th>Storage</th>
                    <th>Retention Time</th>
                    <th>Protection</th>
                    <th>Disposition</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleSavedEntries.map((record) => {
                    const data = record.form_data || {};

                    return (
                      <tr key={record.id}>
                        <td>{displayFactory(record)}</td>
                        <td>{data.documentNumber || "-"}</td>
                        <td>{data.documentName || "-"}</td>
                        <td>{data.versionNumber || "-"}</td>
                        <td>{data.date || "-"}</td>
                        <td>{data.storage || "-"}</td>
                        <td>{data.retentionTime || "-"}</td>
                        <td>{data.protection || "-"}</td>
                        <td>{data.disposition || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type NCRFormData = {
  factory: Factory;
  originatorName: string;
  productDescription: string;
  contractorSupplier: string;
  batchNumber: string;
  quantity: string;
  ncrNumber: string;
  foundDuring: string[];
  otherActivity: string;
  problemDescription: string;
  immediateAction: string;
  dateOfOccurrence: string;
  reportingSignature: string;
  reportingDate: string;
  criticality: string;
  retestingResult: string;
  disposition: string;
  otherDisposition: string;
  requiredAction: string;
  owner: string;
  dateAssigned: string;
  investigationDueDate: string;
  correctiveActionCompleted: string;
  productionManagerName: string;
  productionManagerDate: string;
  productionManagerSignature: string;
  correctiveActionApproval: string;
  capaRcaNumber: string;
  ownerName: string;
  ownerDate: string;
  ownerSignature: string;
  qualityDesignee: string;
  plannedDispositionCompleted: string;
  newNCRNumber: string;
  qualitySignature: string;
  qualityDate: string;
};

type SavedNCR = {
  id: number;
  record_number: string;
  factory: string;
  status: string;
  form_data: Record<string, any>;
  created_at: string;
};

const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const emptyNCR = (): NCRFormData => ({
  factory: "",
  originatorName: "",
  productDescription: "",
  contractorSupplier: "",
  batchNumber: "",
  quantity: "",
  ncrNumber: "",
  foundDuring: [],
  otherActivity: "",
  problemDescription: "",
  immediateAction: "",
  dateOfOccurrence: "",
  reportingSignature: "",
  reportingDate: "",
  criticality: "",
  retestingResult: "",
  disposition: "",
  otherDisposition: "",
  requiredAction: "",
  owner: "",
  dateAssigned: todayISO(),
  investigationDueDate: "",
  correctiveActionCompleted: "",
  productionManagerName: "",
  productionManagerDate: "",
  productionManagerSignature: "",
  correctiveActionApproval: "",
  capaRcaNumber: "",
  ownerName: "",
  ownerDate: "",
  ownerSignature: "",
  qualityDesignee: "",
  plannedDispositionCompleted: "",
  newNCRNumber: "",
  qualitySignature: "",
  qualityDate: "",
});

function NonConformanceReport() {
  const [form, setForm] = useState<NCRFormData>(emptyNCR());
  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [savedRecords, setSavedRecords] = useState<SavedNCR[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const updateField = (field: keyof NCRFormData, value: any) => {
    setForm((previous) => {
      const updated = { ...previous, [field]: value };

      if (field === "criticality" || field === "dateAssigned") {
        const days =
          updated.criticality === "High"
            ? 10
            : updated.criticality === "Medium/Moderate"
              ? 15
              : updated.criticality === "Low"
                ? 20
                : 0;

        if (days && updated.dateAssigned) {
          const due = new Date(`${updated.dateAssigned}T00:00:00`);
          due.setDate(due.getDate() + days);
          updated.investigationDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
        } else {
          updated.investigationDueDate = "";
        }
      }

      return updated;
    });
  };

  const loadRecords = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_records")
        .select("*")
        .eq("title", "Non-Conformance Report")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedRecords(data || []);
    } catch (error: any) {
      alert("Could not load NCR records: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const generateNCRNumber = async (factory: Factory) => {
    const year = new Date().getFullYear();
    const suffix = factory === "Rockwood" ? "R" : "N";

    const { data, error } = await (supabase as any)
      .from("fms_quality_records")
      .select("record_number, form_data")
      .eq("title", "Non-Conformance Report")
      .eq("factory", factory.toLowerCase());

    if (error) throw error;

    const numbers = (data || [])
      .map((record: any) => {
        const number =
          record.form_data?.ncrNumber || record.record_number || "";
        const match = String(number).match(
          new RegExp(`NCR\\s+(\\d+)/${year}/${suffix}`),
        );
        return match ? Number(match[1]) : 0;
      });

    const nextNumber = Math.max(0, ...numbers) + 1;
    return `NCR ${String(nextNumber).padStart(2, "0")}/${year}/${suffix}`;
  };

  const saveNCR = async () => {
    if (saving) return;

    if (!form.factory) {
      alert("Please select a factory: Rockwood or Nguni.");
      return;
    }

    if (
      !form.originatorName.trim() ||
      !form.productDescription.trim() ||
      !form.batchNumber.trim() ||
      !form.problemDescription.trim()
    ) {
      alert("Please complete the Factory, Originator Name, Product Description, Batch Number and Problem Description.");
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this NCR.");
        return;
      }

      const ncrNumber = await generateNCRNumber(form.factory);
      const completedForm = { ...form, ncrNumber };

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Non-Conformance Report",
          record_number: ncrNumber,
          factory: form.factory.toLowerCase(),
          form_data: {
            ...completedForm,
            factory: form.factory,
          },
          status: "submitted",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert(`Non-Conformance Report saved successfully.\nNCR Number: ${ncrNumber}`);

      setForm(emptyNCR());
      await loadRecords();
      setActiveView("master");
    } catch (error: any) {
      console.error("NCR save error:", error);
      alert("Could not save NCR: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivity = (activity: string) => {
    const selected = form.foundDuring.includes(activity);
    updateField(
      "foundDuring",
      selected
        ? form.foundDuring.filter((item) => item !== activity)
        : [...form.foundDuring, activity],
    );
  };

  const textInput = (
    label: string,
    field: keyof NCRFormData,
    type = "text",
  ) => (
    <label className="ncr-field">
      <span>{label}</span>
      <input
        type={type}
        value={String(form[field] || "")}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </label>
  );

  const textArea = (label: string, field: keyof NCRFormData) => (
    <label className="ncr-field ncr-full">
      <span>{label}</span>
      <textarea
        value={String(form[field] || "")}
        onChange={(event) => updateField(field, event.target.value)}
        rows={4}
      />
    </label>
  );

  const radioOptions = (
    label: string,
    field: keyof NCRFormData,
    options: string[],
  ) => (
    <div className="ncr-choice-group">
      <strong>{label}</strong>
      <div className="ncr-options">
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={String(field)}
              checked={form[field] === option}
              onChange={() => updateField(field, option)}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );

  const filteredRecords = savedRecords.filter((record) => {
    const data = record.form_data || {};
    return [
      record.record_number,
      record.factory,
      data.factory,
      data.originatorName,
      data.productDescription,
      data.batchNumber,
      record.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  return (
    <div className="quality-register-page ncr-page">
      <div className="register-topbar no-print">
        <div className="register-heading">
          <h1>Non-Conformance Report</h1>
          <p>Quality Management System · MS Q002 FORM 1</p>
        </div>
        <div className="register-actions">
          {activeView === "new" ? (
            <button
              type="button"
              className="register-btn"
              onClick={() => window.print()}
            >
              Print Form
            </button>
          ) : (
            <button
              type="button"
              className="register-btn"
              onClick={loadRecords}
              disabled={loading}
            >
              Refresh Records
            </button>
          )}
        </div>
      </div>

      <div className="register-tabs no-print">
        <button
          type="button"
          className={`register-tab ${activeView === "new" ? "active" : ""}`}
          onClick={() => setActiveView("new")}
        >
          New NCR
        </button>
        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => setActiveView("master")}
        >
          Master NCR Register ({savedRecords.length})
        </button>
      </div>

      {activeView === "new" ? (
        <>
          <div className="ncr-sheet">
            <div className="ncr-header">
              <div className="ncr-logo">
                <img src="/images/mslogo.png" alt="Maharaja's Spices" />
              </div>
              <div className="ncr-title">Non-Conformance<br />Report Form</div>
              <div className="ncr-document-details">
                <div><span>Doc No.:</span><strong>MS Q002 FORM 1</strong></div>
                <div><span>Issue Date:</span><strong>03/07/2023</strong></div>
                <div><span>Version No.:</span><strong>1</strong></div>
                <div><span>Rev Date:</span><strong>14/01/2025</strong></div>
              </div>
              <div className="ncr-approval-row">
                <span>Compiled By:</span><input value=" " readOnly />
                <span>Approved By:</span><input value=" " readOnly />
              </div>
            </div>

            <div className="ncr-factory no-print">
              <label>
                Factory *
                <select
                  value={form.factory}
                  onChange={(event) =>
                    updateField("factory", event.target.value as Factory)
                  }
                  required
                >
                  <option value="">Select factory</option>
                  <option value="Rockwood">Rockwood</option>
                  <option value="Nguni">Nguni</option>
                </select>
              </label>
            </div>
            <div className="ncr-factory print-only">
              Factory: {form.factory || "Not selected"}
            </div>

            <h3 className="ncr-section-heading">
              SECTION 1: (To be completed by Reporting Party)
            </h3>

            <div className="ncr-grid">
              {textInput("Originator Name:", "originatorName")}
              {textInput("Product Description:", "productDescription")}
              {textInput("Contractor/Supplier:", "contractorSupplier")}
              {textInput("Batch Number:", "batchNumber")}
              {textInput("Qty:", "quantity")}
              {textInput("NCR Number:", "ncrNumber")}
            </div>

            <div className="ncr-block">
              <strong>FOUND DURING WHAT ACTIVITY:</strong>
              <div className="ncr-options ncr-activity">
                {["Incoming Inspection", "Final Inspection", "In-process Inspection", "Other"].map((item) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={form.foundDuring.includes(item)}
                      onChange={() => toggleActivity(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
              {form.foundDuring.includes("Other") &&
                textInput("Other activity:", "otherActivity")}
            </div>

            {textArea("PROBLEM DESCRIPTION (attach any supporting documents):", "problemDescription")}
            {textArea("IMMEDIATE ACTION TAKEN:", "immediateAction")}

            <div className="ncr-grid ncr-bottom-fields">
              {textInput("Date of Occurrence:", "dateOfOccurrence", "date")}
              {textInput("Reporting Party Signature:", "reportingSignature")}
              {textInput("Date:", "reportingDate", "date")}
            </div>
          </div>

          <div className="ncr-sheet ncr-second-page">
            <h3 className="ncr-section-heading">
              SECTION 2: (To be completed by Production Manager)
            </h3>

            {radioOptions("CRITICALITY LEVEL:", "criticality", ["High", "Medium/Moderate", "Low"])}
            {textArea("RETESTING OF PRODUCT RESULT:", "retestingResult")}
            {radioOptions("DISPOSITION:", "disposition", ["Use-as-is", "Rework", "Return to supplier", "Repair", "Reject", "Other"])}
            {form.disposition === "Other" && textInput("Other disposition:", "otherDisposition")}
            {textArea("REQUIRED ACTION:", "requiredAction")}

            <div className="ncr-grid">
              {textInput("Owner:", "owner")}
              {textInput("Date Assigned:", "dateAssigned", "date")}
              {textInput("Investigation due date:", "investigationDueDate", "date")}
            </div>

            <div className="ncr-block">
              <strong>Planned Disposition has been completed and Corrective action has been initiated (Attach proof of completion where possible)</strong>
              {radioOptions("", "correctiveActionCompleted", ["Yes", "No"])}
              {textInput("New NCR No. if no:", "newNCRNumber")}
              <div className="ncr-grid">
                {textInput("Name:", "productionManagerName")}
                {textInput("Date:", "productionManagerDate", "date")}
                {textInput("Signature:", "productionManagerSignature")}
              </div>
            </div>

            <h3 className="ncr-section-heading">
              SECTION 3: (To be completed by Owner & return to Production Manager for review prior to due date)
            </h3>

            {radioOptions("Approval of Corrective/Preventative Action:", "correctiveActionApproval", ["Yes", "No"])}
            {textInput("CAPA & RCA Form No. Issued:", "capaRcaNumber")}
            <div className="ncr-grid">
              {textInput("Name:", "ownerName")}
              {textInput("Date:", "ownerDate", "date")}
              {textInput("Signature:", "ownerSignature")}
            </div>

            <h3 className="ncr-section-heading">
              SECTION 4: (To be completed by Quality Designee or Other (Specify) completes:
            </h3>

            {textInput("Quality Designee / Other:", "qualityDesignee")}
            <div className="ncr-block">
              <strong>CLOSING THE NON-CONFORMANCE</strong>
              <p>Planned Disposition has been completed and Corrective action has been initiated:</p>
              <p>(Attach proof of completion where possible)</p>
              {radioOptions("", "plannedDispositionCompleted", ["Yes", "No"])}
              {textInput("If No, new NCR No.:", "newNCRNumber")}
              <div className="ncr-grid">
                {textInput("Quality Designee Signature:", "qualitySignature")}
                {textInput("Date:", "qualityDate", "date")}
              </div>
            </div>
          </div>

          <div className="no-print ncr-save-area">
            <button
              type="button"
              className="register-btn primary"
              onClick={saveNCR}
              disabled={saving}
            >
              {saving ? "Saving NCR..." : "Save Non-Conformance Report"}
            </button>
          </div>
        </>
      ) : (
        <div className="register-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Non-Conformance Register</h2>
              <p>Saved Non-Conformance Reports for Rockwood and Nguni.</p>
            </div>
            <span className="record-count">{filteredRecords.length} records</span>
          </div>

          <input
            className="register-search"
            placeholder="Search factory, NCR number, product or batch..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {loading ? (
            <div className="empty-state">Loading NCR records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">No NCR records found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>NCR Number</th>
                    <th>Product</th>
                    <th>Batch Number</th>
                    <th>Criticality</th>
                    <th>Investigation Due</th>
                    <th>Status</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const data = record.form_data || {};
                    const factory = String(record.factory || data.factory || "");
                    return (
                      <tr key={record.id}>
                        <td>{factory.toLowerCase() === "rockwood" ? "Rockwood" : factory.toLowerCase() === "nguni" ? "Nguni" : "-"}</td>
                        <td>{record.record_number}</td>
                        <td>{data.productDescription || "-"}</td>
                        <td>{data.batchNumber || "-"}</td>
                        <td>{data.criticality || "-"}</td>
                        <td>{data.investigationDueDate || "-"}</td>
                        <td>{record.status || "-"}</td>
                        <td>{record.created_at ? new Date(record.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


type QuarantineFormData = {
  factory: Factory;
  dateQuarantined: string;
  tagNumber: string;
  supplierName: string;
  batchNumber: string;
  productDescription: string;
  reasonForQuarantine: string;
  customerName: string;
  quantityInQuarantine: string;
  quarantineType: string;
  ncrNumber: string;
  quarantineName: string;
  quarantineSignature: string;
  deliveryNoteNumber: string;
  releaseDecision: string;
  releaseSignature: string;
  releaseDate: string;
};

type SavedQuarantine = {
  id: number;
  record_number: string;
  factory: string;
  status: string;
  form_data: Record<string, any>;
  created_at: string;
};

const emptyQuarantine = (): QuarantineFormData => ({
  factory: "",
  dateQuarantined: todayISO(),
  tagNumber: "",
  supplierName: "",
  batchNumber: "",
  productDescription: "",
  reasonForQuarantine: "",
  customerName: "",
  quantityInQuarantine: "",
  quarantineType: "",
  ncrNumber: "",
  quarantineName: "",
  quarantineSignature: "",
  deliveryNoteNumber: "",
  releaseDecision: "",
  releaseSignature: "",
  releaseDate: "",
});

function QualityQuarantineTag() {
  const [form, setForm] = useState<QuarantineFormData>(emptyQuarantine());
  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [records, setRecords] = useState<SavedQuarantine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const updateField = (
    field: keyof QuarantineFormData,
    value: string,
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const loadRecords = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_records")
        .select("*")
        .eq("title", "Quarantine Tag")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
    } catch (error: any) {
      alert("Could not load quarantine records: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const saveQuarantine = async () => {
    if (saving) return;

    if (!form.factory) {
      alert("Please select a factory: Rockwood or Nguni.");
      return;
    }

    if (
      !form.tagNumber.trim() ||
      !form.productDescription.trim() ||
      !form.reasonForQuarantine.trim()
    ) {
      alert("Please complete the Tag Number, Product Description and Reason for Quarantine.");
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this quarantine tag.");
        return;
      }

      const completedForm = { ...form };

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Quarantine Tag",
          record_number: form.tagNumber.trim(),
          factory: form.factory.toLowerCase(),
          form_data: {
            ...completedForm,
            factory: form.factory,
          },
          status: form.releaseDecision ? "released" : "quarantined",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert("Quarantine Tag saved successfully!");

      setForm(emptyQuarantine());
      await loadRecords();
      setActiveView("master");
    } catch (error: any) {
      console.error("Quarantine Tag save error:", error);
      alert("Could not save Quarantine Tag: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const textInput = (
    label: string,
    field: keyof QuarantineFormData,
    type = "text",
  ) => (
    <label className="ncr-field">
      <span>{label}</span>
      <input
        type={type}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </label>
  );

  const textArea = (
    label: string,
    field: keyof QuarantineFormData,
  ) => (
    <label className="ncr-field ncr-full">
      <span>{label}</span>
      <textarea
        rows={3}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </label>
  );

  const radioOptions = (
    label: string,
    field: keyof QuarantineFormData,
    options: string[],
  ) => (
    <div className="ncr-choice-group">
      <strong>{label}</strong>
      <div className="ncr-options">
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={field}
              checked={form[field] === option}
              onChange={() => updateField(field, option)}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );

  const filteredRecords = records.filter((record) => {
    const data = record.form_data || {};

    return [
      record.record_number,
      record.factory,
      data.tagNumber,
      data.batchNumber,
      data.productDescription,
      data.supplierName,
      data.customerName,
      data.releaseDecision,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  return (
    <div className="quality-register-page">
      <div className="register-topbar no-print">
        <div className="register-heading">
          <h1>Quarantine Tag</h1>
          <p>Quality Management System · MS Q002 FORM 2</p>
        </div>

        <div className="register-actions">
          {activeView === "new" ? (
            <button
              type="button"
              className="register-btn"
              onClick={() => window.print()}
            >
              Print Tag
            </button>
          ) : (
            <button
              type="button"
              className="register-btn"
              onClick={loadRecords}
              disabled={loading}
            >
              Refresh Records
            </button>
          )}
        </div>
      </div>

      <div className="register-tabs no-print">
        <button
          type="button"
          className={`register-tab ${activeView === "new" ? "active" : ""}`}
          onClick={() => setActiveView("new")}
        >
          New Quarantine Tag
        </button>

        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => setActiveView("master")}
        >
          Master Quarantine Register ({records.length})
        </button>
      </div>

      {activeView === "new" ? (
        <>
          <div className="ncr-sheet">
            <div className="ncr-header">
              <div className="ncr-logo">
                <img src="/images/mslogo.png" alt="Maharaja's Spices" />
              </div>

              <div className="ncr-title">
                QUARANTINE TAG
              </div>

              <div className="ncr-document-details">
                <div><span>Doc No.:</span><strong>MS Q002 FORM 2</strong></div>
                <div><span>Issue Date:</span><strong>12/06/2019</strong></div>
                <div><span>Version No.:</span><strong>2</strong></div>
                <div><span>Rev Date:</span><strong>14/01/2025</strong></div>
              </div>

              <div className="ncr-approval-row">
                <span>Compiled By:</span>
                <strong>Tania Naicker</strong>
                <span>Approved By:</span>
                <strong>Livinia Govender</strong>
              </div>
            </div>

            <div className="ncr-factory no-print">
              <label>
                Factory *
                <select
                  value={form.factory}
                  onChange={(event) =>
                    updateField("factory", event.target.value)
                  }
                  required
                >
                  <option value="">Select factory</option>
                  <option value="Rockwood">Rockwood</option>
                  <option value="Nguni">Nguni</option>
                </select>
              </label>
            </div>

            <div className="ncr-factory print-only">
              Factory: {form.factory || "Not selected"}
            </div>

            <div className="ncr-grid">
              {textInput("Date Quarantined:", "dateQuarantined", "date")}
              {textInput("Tag No.:", "tagNumber")}
              {textInput("Name of Supplier:", "supplierName")}
              {textInput("Batch Number:", "batchNumber")}
              {textInput("Product Description:", "productDescription")}
              {textInput("Name of Customer:", "customerName")}
              {textInput("Quantity in Quarantine:", "quantityInQuarantine")}
            </div>

            {textArea("Reason for Quarantine:", "reasonForQuarantine")}

            {radioOptions(
              "Quarantine Type:",
              "quarantineType",
              ["Rework", "Scrap"],
            )}

            <div className="ncr-grid">
              {textInput("NCR No.:", "ncrNumber")}
              {textInput("Name:", "quarantineName")}
              {textInput("Delivery Note No.:", "deliveryNoteNumber")}
              {textInput("Signature:", "quarantineSignature")}
            </div>

            <h3 className="ncr-section-heading">
              RELEASE
            </h3>

            {radioOptions(
              "Release Decision:",
              "releaseDecision",
              [
                "Return to Supplier",
                "Accept on concession",
                "Return to stock",
                "Sell on concession",
              ],
            )}

            <div className="ncr-grid">
              {textInput("Release Signature:", "releaseSignature")}
              {textInput("Release Date:", "releaseDate", "date")}
            </div>

            <div className="document-footer">
              <span>Doc No.: MS Q002 FORM 2</span>
              <span>Controlled Quality Document</span>
              <span>Version No.: 2</span>
            </div>
          </div>

          <div className="no-print ncr-save-area">
            <button
              type="button"
              className="register-btn primary"
              onClick={saveQuarantine}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Quarantine Tag"}
            </button>
          </div>
        </>
      ) : (
        <div className="register-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Quarantine Register</h2>
              <p>Quarantine records for Rockwood and Nguni.</p>
            </div>

            <span className="record-count">
              {filteredRecords.length} records
            </span>
          </div>

          <input
            className="register-search"
            placeholder="Search tag, factory, product, batch or supplier..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {loading ? (
            <div className="empty-state">Loading quarantine records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">No quarantine records found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Tag No.</th>
                    <th>Date Quarantined</th>
                    <th>Product</th>
                    <th>Batch Number</th>
                    <th>Supplier</th>
                    <th>Quantity</th>
                    <th>Quarantine Type</th>
                    <th>Release Decision</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => {
                    const data = record.form_data || {};
                    const factory = String(record.factory || data.factory || "");

                    return (
                      <tr key={record.id}>
                        <td>
                          {factory.toLowerCase() === "rockwood"
                            ? "Rockwood"
                            : factory.toLowerCase() === "nguni"
                              ? "Nguni"
                              : "-"}
                        </td>
                        <td>{record.record_number || "-"}</td>
                        <td>{data.dateQuarantined || "-"}</td>
                        <td>{data.productDescription || "-"}</td>
                        <td>{data.batchNumber || "-"}</td>
                        <td>{data.supplierName || "-"}</td>
                        <td>{data.quantityInQuarantine || "-"}</td>
                        <td>{data.quarantineType || "-"}</td>
                        <td>{data.releaseDecision || "-"}</td>
                        <td>{record.status || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


type ConcessionItem = {
  id: number;
  itemNumber: string;
  signature: string;
  price: string;
};

type ConcessionFormData = {
  factory: Factory;
  date: string;
  requesterName: string;
  companyName: string;
  address: string;
  contactPerson: string;
  deliveryNoteNumber: string;
  invoiceNumber: string;
  productDescription: string;
  ncrNumber: string;
  reasonForConcession: string;
  acceptanceReason: string;
  acceptingSignature: string;
  acceptingDate: string;
  items: ConcessionItem[];
};

type SavedConcession = {
  id: string;
  record_number: string;
  factory: string;
  form_data: ConcessionFormData;
  status: string;
  created_at: string;
};

const emptyConcession = (): ConcessionFormData => ({
  factory: "",
  date: new Date().toISOString().slice(0, 10),
  requesterName: "",
  companyName: "",
  address: "",
  contactPerson: "",
  deliveryNoteNumber: "",
  invoiceNumber: "",
  productDescription: "",
  ncrNumber: "",
  reasonForConcession: "",
  acceptanceReason: "",
  acceptingSignature: "",
  acceptingDate: "",
  items: [{ id: 1, itemNumber: "1", signature: "", price: "" }],
});

function QualityConcessionRecord() {
  const [form, setForm] = useState<ConcessionFormData>(emptyConcession());
  const [records, setRecords] = useState<SavedConcession[]>([]);
  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadRecords = async () => {
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("fms_quality_records")
      .select("*")
      .eq("title", "Concession Record")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading concession records:", error);
      alert("Could not load the Concession Register.");
    } else {
      setRecords((data || []) as SavedConcession[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const updateField = (field: keyof ConcessionFormData, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateItem = (
    id: number,
    field: keyof ConcessionItem,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          id: Date.now(),
          itemNumber: String(previous.items.length + 1),
          signature: "",
          price: "",
        },
      ],
    }));
  };

  const removeItem = (id: number) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items
        .filter((item) => item.id !== id)
        .map((item, index) => ({
          ...item,
          itemNumber: String(index + 1),
        })),
    }));
  };

  const saveConcession = async () => {
    if (!form.factory) {
      alert("Please select a factory.");
      return;
    }

    if (!form.date || !form.requesterName.trim()) {
      alert("Please complete the date and name of the person requesting concession.");
      return;
    }

    if (!form.productDescription.trim() || !form.reasonForConcession.trim()) {
      alert("Please complete the product description and reason for concession.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session could not be verified. Please log in again.");
      }

      const recordNumber = `CON-${new Date().getFullYear()}-${Date.now()}`;

      const { error } = await supabase
        .from("fms_quality_records")
        .insert({
          title: "Concession Record",
          record_number: recordNumber,
          factory: form.factory.toLowerCase(),
          form_data: {
            ...form,
            factory: form.factory,
          },
          status: "submitted",
          created_by: user.id,
          updated_by: user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert(`Concession Record saved successfully.\nInternal Reference: ${recordNumber}`);

      setForm(emptyConcession());
      await loadRecords();
      setActiveView("master");
    } catch (error: any) {
      console.error("Error saving concession record:", error);
      alert(error.message || "Could not save the Concession Record.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    const data = record.form_data || {};
    const search = searchTerm.toLowerCase();

    return [
      record.record_number,
      record.factory,
      data.requesterName,
      data.companyName,
      data.productDescription,
      data.ncrNumber,
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });

  const inputField = (
    label: string,
    field: keyof ConcessionFormData,
    type = "text"
  ) => (
    <label className="ncr-field">
      <span>{label}</span>
      <input
        type={type}
        value={String(form[field] || "")}
        onChange={(e) => updateField(field, e.target.value)}
      />
    </label>
  );

  const textAreaField = (
    label: string,
    field: keyof ConcessionFormData
  ) => (
    <label className="ncr-field">
      <span>{label}</span>
      <textarea
        value={String(form[field] || "")}
        onChange={(e) => updateField(field, e.target.value)}
        rows={3}
      />
    </label>
  );

  return (
    <div className="quality-register-page">
      <div className="register-topbar no-print">
        <h2>Concession Record</h2>
        <button
          className="register-btn"
          type="button"
          onClick={loadRecords}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Register"}
        </button>
      </div>

      <div className="register-tabs no-print">
  <button
    type="button"
    className={`register-tab ${activeView === "new" ? "active" : ""}`}
    onClick={() => setActiveView("new")}
  >
    New Concession Record
  </button>

  <button
    type="button"
    className={`register-tab ${activeView === "master" ? "active" : ""}`}
    onClick={() => {
      setActiveView("master");
      loadRecords();
    }}
  >
    Master Concession Register ({records.length})
  </button>
</div>

      {activeView === "new" && (
        <div className="register-paper">
          <div className="ncr-sheet">
            <div className="ncr-header">
              <img
                className="ncr-logo"
                src="/images/mslogo.png"
                alt="Maharaja's Spices"
              />
              <div className="ncr-title">CONCESSION RECORD</div>
            </div>

            <div className="ncr-document-details">
              <span>Doc No.: MS Q002 FORM 3</span>
              <span>Issue Date: 12/06/2019</span>
              <span>Version No.: 2</span>
              <span>Rev Date: 14/01/2025</span>
            </div>

            <div className="ncr-approval-row">
              <span>Compiled By: Tania Naicker</span>
              <span>Approved By: Livinia Govender</span>
            </div>

            <div className="ncr-factory">
              <label>
                Factory:
                <select
                  value={form.factory}
                  onChange={(e) =>
                    updateField("factory", e.target.value)
                  }
                >
                  <option value="">Select Factory</option>
                  <option value="Rockwood">Rockwood</option>
                  <option value="Nguni">Nguni</option>
                </select>
              </label>
              <span>
                Internal Record Ref.: Generated when saved
              </span>
            </div>

            <div className="ncr-grid">
              {inputField("Date", "date", "date")}
              {inputField("Name of person requesting concession", "requesterName")}
              {inputField("Company Name", "companyName")}
              {inputField("Address", "address")}
              {inputField("Contact Person", "contactPerson")}
              {inputField("Delivery Note No.", "deliveryNoteNumber")}
              {inputField("Invoice No.", "invoiceNumber")}
              {inputField("NCR No.", "ncrNumber")}
            </div>

            <div className="ncr-section-heading">
              PRODUCT DESCRIPTION
            </div>
            {textAreaField("Product Description", "productDescription")}

            <div className="ncr-section-heading">
              REASON FOR CONCESSION
            </div>
            {textAreaField("Reason for Concession", "reasonForConcession")}

            <div className="ncr-section-heading">
              CONCESSION DETAILS
            </div>

            <table className="master-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Signature</th>
                  <th>Price</th>
                  <th className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        value={item.itemNumber}
                        onChange={(e) =>
                          updateItem(item.id, "itemNumber", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={item.signature}
                        onChange={(e) =>
                          updateItem(item.id, "signature", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={item.price}
                        onChange={(e) =>
                          updateItem(item.id, "price", e.target.value)
                        }
                      />
                    </td>
                    <td className="no-print">
                      <button
                        type="button"
                        className="register-btn"
                        onClick={() => removeItem(item.id)}
                        disabled={form.items.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              className="register-btn no-print"
              onClick={addItem}
            >
              + Add Row
            </button>

            <div className="ncr-section-heading">
              PERSON ACCEPTING CONCESSION
            </div>

            {textAreaField(
              "Reason for accepting / not accepting",
              "acceptanceReason"
            )}

            <div className="ncr-grid">
              {inputField("Signature", "acceptingSignature")}
              {inputField("Date", "acceptingDate", "date")}
            </div>

            <div className="document-footer">
              <span>Doc No.: MS Q002 FORM 3</span>
              <span>Page 1 of 1</span>
              <span>Version No.: 2</span>
            </div>
          </div>

          <div className="ncr-save-area no-print">
            <button
              type="button"
              className="register-btn"
              onClick={() => window.print()}
            >
              Print Form
            </button>
            <button
              type="button"
              className="register-btn"
              onClick={saveConcession}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Concession Record"}
            </button>
          </div>
        </div>
      )}

      {activeView === "master" && (
        <div className="register-paper">
          <div className="register-topbar">
            <h3>Master Concession Register</h3>
            <input
              className="register-search"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Loading records...</p>
          ) : (
            <div className="table-responsive">
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Internal Record Ref.</th>
                    <th>Date</th>
                    <th>Requester</th>
                    <th>Company</th>
                    <th>Product Description</th>
                    <th>NCR No.</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No concession records found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.factory}</td>
                        <td>{record.record_number}</td>
                        <td>{record.form_data?.date || "—"}</td>
                        <td>{record.form_data?.requesterName || "—"}</td>
                        <td>{record.form_data?.companyName || "—"}</td>
                        <td>{record.form_data?.productDescription || "—"}</td>
                        <td>{record.form_data?.ncrNumber || "—"}</td>
                        <td>{record.status || "Submitted"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


type QuarantineRegisterEntry = {
  id: number;
  date: string;
  number: string;
  description: string;
  reason: string;
  actioned: string;
  ncrNumber: string;
  supplier: string;
  deliveryNoteNumber: string;
  batchNumber: string;
  quantityAffected: string;
  quantityPerOutcome: string;
  outcome: string;
  comment: string;
  authorisedBy: string;
};

type SavedQuarantineRegister = {
  id: string;
  record_number: string;
  factory: string;
  form_data: {
    factory: string;
    entries: QuarantineRegisterEntry[];
  };
  status: string;
  created_at: string;
};

const emptyQuarantineRegisterEntry = (): QuarantineRegisterEntry => ({
  id: Date.now(),
  date: new Date().toISOString().slice(0, 10),
  number: "",
  description: "",
  reason: "",
  actioned: "",
  ncrNumber: "",
  supplier: "",
  deliveryNoteNumber: "",
  batchNumber: "",
  quantityAffected: "",
  quantityPerOutcome: "",
  outcome: "",
  comment: "",
  authorisedBy: "",
});

function QualityQuarantineRegister() {
  const [factory, setFactory] = useState<Factory>("");
  const [entries, setEntries] = useState<QuarantineRegisterEntry[]>([
    emptyQuarantineRegisterEntry(),
  ]);
  const [records, setRecords] = useState<SavedQuarantineRegister[]>([]);
  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const outcomes = [
    "Return to supplier",
    "Accepted on Concession",
    "Returned to Stock",
    "Sold on Concession",
    "Scrapped",
  ];

  const loadRecords = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("fms_quality_records")
      .select("*")
      .eq("title", "Quarantine Register")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading quarantine register:", error);
      alert("Could not load the Quarantine Register.");
    } else {
      setRecords((data || []) as SavedQuarantineRegister[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const updateEntry = (
    id: number,
    field: keyof QuarantineRegisterEntry,
    value: string
  ) => {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const addEntry = () => {
    setEntries((previous) => [
      ...previous,
      {
        ...emptyQuarantineRegisterEntry(),
        id: Date.now() + previous.length,
        number: String(previous.length + 1),
      },
    ]);
  };

  const removeEntry = (id: number) => {
    setEntries((previous) =>
      previous
        .filter((entry) => entry.id !== id)
        .map((entry, index) => ({
          ...entry,
          number: String(index + 1),
        }))
    );
  };

  const saveRegister = async () => {
    if (!factory) {
      alert("Please select a factory.");
      return;
    }

    const completedEntries = entries.filter(
      (entry) =>
        entry.description.trim() ||
        entry.reason.trim() ||
        entry.supplier.trim() ||
        entry.ncrNumber.trim()
    );

    if (completedEntries.length === 0) {
      alert("Please enter at least one quarantine register entry.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session could not be verified. Please log in again.");
      }

      const recordNumber = `QREG-${new Date().getFullYear()}-${Date.now()}`;

      const { error } = await supabase
        .from("fms_quality_records")
        .insert({
          title: "Quarantine Register",
          record_number: recordNumber,
          factory: factory.toLowerCase(),
          form_data: {
            factory,
            entries: completedEntries,
          },
          status: "submitted",
          created_by: user.id,
          updated_by: user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert(`Quarantine Register saved successfully.\nInternal Reference: ${recordNumber}`);

      setFactory("");
      setEntries([emptyQuarantineRegisterEntry()]);
      await loadRecords();
      setActiveView("master");
    } catch (error: any) {
      console.error("Error saving quarantine register:", error);
      alert(error.message || "Could not save the Quarantine Register.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    const search = searchTerm.toLowerCase();
    const data = record.form_data || {};

    return [
      record.record_number,
      record.factory,
      ...(data.entries || []).flatMap((entry) => [
        entry.description,
        entry.supplier,
        entry.ncrNumber,
        entry.batchNumber,
        entry.outcome,
      ]),
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });

  const field = (
    entry: QuarantineRegisterEntry,
    label: string,
    key: keyof QuarantineRegisterEntry,
    type = "text"
  ) => (
    <label className="ncr-field">
      <span>{label}</span>
      <input
        type={type}
        value={entry[key] as string}
        onChange={(e) => updateEntry(entry.id, key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="quality-register-page">
      <div className="register-topbar no-print">
        <h2>Quarantine Register</h2>
        <button
          type="button"
          className="register-btn"
          onClick={loadRecords}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Register"}
        </button>
      </div>

      <div className="register-tabs no-print">
        <button
          type="button"
          className={`register-tab ${activeView === "new" ? "active" : ""}`}
          onClick={() => setActiveView("new")}
        >
          New Register Entry
        </button>

        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => {
            setActiveView("master");
            loadRecords();
          }}
        >
          Master Quarantine Register ({records.length})
        </button>
      </div>

      {activeView === "new" && (
        <div className="register-paper">
          <div className="ncr-sheet">
            <div className="ncr-header">
              <img
                className="ncr-logo"
                src="/images/mslogo.png"
                alt="Maharaja's Spices"
              />
              <div className="ncr-title">QUARANTINE REGISTER</div>
            </div>

            <div className="ncr-document-details">
              <span>Doc No.: MS Q002 LOG 2</span>
              <span>Issue Date: 12/06/2019</span>
              <span>Revision Date: 14/01/2025</span>
              <span>Version No.: 2</span>
            </div>

            <div className="ncr-approval-row">
              <span>Compiled By: Tania Naicker</span>
              <span>Approved By: Livinia Govender</span>
            </div>

            <div className="ncr-factory">
              <label>
                Factory:
                <select
                  value={factory}
                  onChange={(e) => setFactory(e.target.value as Factory)}
                >
                  <option value="">Select Factory</option>
                  <option value="Rockwood">Rockwood</option>
                  <option value="Nguni">Nguni</option>
                </select>
              </label>
            </div>

            <div className="ncr-section-heading">
              QUARANTINE REGISTER ENTRIES
            </div>

            {entries.map((entry, index) => (
              <div className="ncr-register-entry" key={entry.id}>
                <div className="ncr-section-heading">
                  Entry {index + 1}
                  <button
                    type="button"
                    className="register-btn no-print"
                    onClick={() => removeEntry(entry.id)}
                    disabled={entries.length === 1}
                  >
                    Remove Entry
                  </button>
                </div>

                <div className="ncr-grid">
                  {field(entry, "Date", "date", "date")}
                  {field(entry, "No.", "number")}
                  {field(entry, "NCR No.", "ncrNumber")}
                  {field(entry, "Supplier", "supplier")}
                  {field(entry, "Delivery Note No.", "deliveryNoteNumber")}
                  {field(entry, "Batch No.", "batchNumber")}
                  {field(entry, "Quantity Affected", "quantityAffected")}
                </div>

                {field(entry, "Description of Material", "description")}
                {field(entry, "Reason for Quarantine", "reason")}

                <div className="ncr-grid">
                  {field(entry, "Actioned", "actioned")}
                  <label className="ncr-field">
                    <span>Outcome</span>
                    <select
                      value={entry.outcome}
                      onChange={(e) =>
                        updateEntry(entry.id, "outcome", e.target.value)
                      }
                    >
                      <option value="">Select Outcome</option>
                      {outcomes.map((outcome) => (
                        <option key={outcome} value={outcome}>
                          {outcome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {field(entry, "Quantity per Outcome", "quantityPerOutcome")}
                  {field(entry, "Authorised By", "authorisedBy")}
                </div>

                {field(entry, "Comment", "comment")}
              </div>
            ))}

            <button
              type="button"
              className="register-btn no-print"
              onClick={addEntry}
            >
              + Add Register Entry
            </button>

            <div className="document-footer">
              <span>DOC No.: MS Q002 LOG 2</span>
              <span>Page 1 of 1</span>
              <span>Version No.: 2</span>
            </div>
          </div>

          <div className="ncr-save-area no-print">
            <button
              type="button"
              className="register-btn"
              onClick={() => window.print()}
            >
              Print Register
            </button>
            <button
              type="button"
              className="register-btn"
              onClick={saveRegister}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Register"}
            </button>
          </div>
        </div>
      )}

      {activeView === "master" && (
        <div className="register-paper">
          <div className="register-topbar">
            <h3>Master Quarantine Register</h3>
            <input
              className="register-search"
              placeholder="Search register..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Loading register...</p>
          ) : (
            <div className="table-responsive">
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Internal Reference</th>
                    <th>Date</th>
                    <th>Description of Material</th>
                    <th>Supplier</th>
                    <th>Batch No.</th>
                    <th>NCR No.</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No quarantine register entries found.</td>
                    </tr>
                  ) : (
                    filteredRecords.flatMap((record) =>
                      (record.form_data?.entries || []).map((entry) => (
                        <tr key={`${record.id}-${entry.id}`}>
                          <td>{record.factory}</td>
                          <td>{record.record_number}</td>
                          <td>{entry.date || "—"}</td>
                          <td>{entry.description || "—"}</td>
                          <td>{entry.supplier || "—"}</td>
                          <td>{entry.batchNumber || "—"}</td>
                          <td>{entry.ncrNumber || "—"}</td>
                          <td>{entry.outcome || "—"}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}





export default function QualityDigitalForms() {
  const location = useLocation();

  const selectedCategory = new URLSearchParams(location.search).get("category");

  return (
    <div className="quality-register-page">
      {selectedCategory === "Document Control Distribution" && (
        <QualityMasterSheets />
      )}

      {selectedCategory === "Obsolete Document List" && (
        <ObsoleteDocumentList />
      )}

      {selectedCategory === "Non-Conformance Report" && (
        <NonConformanceReport />
      )}
      {selectedCategory === "Quarantine Tag" && (
        <QualityQuarantineTag />
      )}
      {selectedCategory === "Concession Record" && (
        <QualityConcessionRecord />
      )}
      {selectedCategory === "Quarantine Register" && (
  <QualityQuarantineRegister />
)}
      {!selectedCategory && (
        <div className="register-paper">
          Select a form from the Forms section in the sidebar.
        </div>
      )}

      {selectedCategory &&
        ![
          "Document Control Distribution",
          "Obsolete Document List",
          "Non-Conformance Report",
          "Quarantine Tag",
          "Concession Record",
          "Quarantine Register"
        ].includes(selectedCategory) && (
          <div className="register-paper">
            Form not found.
          </div>
        )}
    </div>
  );
}