
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Factory = "Rockwood" | "Nguni";

type NonConformanceFormData = {
  factory: Factory;
  originatorName: string;
  productDescription: string;
  contractorSupplier: string;
  batchNumber: string;
  quantity: string;
  ncrNumber: string;
  activityFound: string[];
  otherActivity: string;
  problemDescription: string;
  immediateAction: string;
  occurrenceDate: string;
  signature: string;
  signatureDate: string;
};

type SavedRecord = {
  id: number;
  record_number: string;
  factory: string;
  form_data: Record<string, any>;
  status: string;
  created_at: string;
};

const createEmptyForm = (): NonConformanceFormData => ({
  factory: "Rockwood",
  originatorName: "",
  productDescription: "",
  contractorSupplier: "",
  batchNumber: "",
  quantity: "",
  ncrNumber: "",
  activityFound: [],
  otherActivity: "",
  problemDescription: "",
  immediateAction: "",
  occurrenceDate: "",
  signature: "",
  signatureDate: "",
});

const ACTIVITY_OPTIONS = [
  "Incoming Inspection",
  "Final Inspection",
  "In-process Inspection",
  "Other",
];

export default function NonConformanceForm() {
  const [form, setForm] = useState<NonConformanceFormData>(
    createEmptyForm()
  );

  const [activeView, setActiveView] = useState<"new" | "master">("new");
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [factoryFilter, setFactoryFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Update form fields
  const updateField = (
    field: keyof NonConformanceFormData,
    value: string | string[]
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // Toggle activity checkboxes
  const toggleActivity = (activity: string) => {
    setForm((previous) => ({
      ...previous,
      activityFound: previous.activityFound.includes(activity)
        ? previous.activityFound.filter((item) => item !== activity)
        : [...previous.activityFound, activity],
    }));
  };

  // Load saved records
  const loadSavedRecords = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_records")
        .select("*")
        .eq("title", "Non-Conformance Report Form")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading NCR records:", error);
        alert("Could not load records: " + error.message);
        return;
      }

      setSavedRecords(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedRecords();
  }, []);

  // Generate NCR number
  const generateNCRNumber = async (factory: Factory) => {
    const suffix = factory === "Rockwood" ? "R" : "N";
    const year = new Date().getFullYear();

    const { count, error } = await (supabase as any)
      .from("fms_quality_records")
      .select("*", { count: "exact", head: true })
      .eq("title", "Non-Conformance Report Form")
      .eq("factory", factory.toLowerCase());

    if (error) {
      throw error;
    }

    return `NCR ${String((count || 0) + 1).padStart(2, "0")}/${year}/${suffix}`;
  };

  // Save report
  const saveRecord = async () => {
    if (saving) return;

    if (
      !form.originatorName.trim() ||
      !form.productDescription.trim() ||
      !form.problemDescription.trim() ||
      !form.occurrenceDate
    ) {
      alert(
        "Please complete the required fields:\n\nOriginator Name\nProduct Description\nProblem Description\nDate of Occurrence"
      );
      return;
    }

    if (
      form.activityFound.includes("Other") &&
      !form.otherActivity.trim()
    ) {
      alert("Please describe the other activity.");
      return;
    }

    if (selectedFiles.length > 0) {
      alert(
        "Supporting documents have been selected, but file uploading has not been connected yet. The report can be saved without them for now."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this report.");
        return;
      }

      const ncrNumber =
        form.ncrNumber.trim() ||
        (await generateNCRNumber(form.factory));

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Non-Conformance Report Form",
          record_number: ncrNumber,
          factory: form.factory.toLowerCase(),
          form_data: {
            ...form,
            ncrNumber,
          },
          status: "submitted",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        console.error("NCR SAVE ERROR:", error);
        alert("Could not save report: " + error.message);
        return;
      }

      alert(`Non-Conformance Report ${ncrNumber} saved successfully!`);

      setForm(createEmptyForm());
      setSelectedFiles([]);

      await loadSavedRecords();
    } catch (error: any) {
      console.error("Unexpected NCR save error:", error);
      alert(error?.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // Filter records
  const visibleRecords = savedRecords.filter((record) => {
    const matchesFactory =
      factoryFilter === "All" ||
      record.factory?.toLowerCase() === factoryFilter.toLowerCase();

    const data = record.form_data || {};

    const searchText = [
      record.record_number,
      record.factory,
      data.originatorName,
      data.productDescription,
      data.contractorSupplier,
      data.batchNumber,
      data.problemDescription,
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesFactory &&
      searchText.includes(searchTerm.toLowerCase())
    );
  });

  // Reusable input
  const input = (
    label: string,
    field: keyof NonConformanceFormData,
    type = "text",
    required = false
  ) => (
    <label className="ncr-field">
      <span>
        {label}
        {required && <b className="ncr-required"> *</b>}
      </span>

      <input
        className="distribution-input"
        type={type}
        value={form[field] as string}
        onChange={(event) =>
          updateField(field, event.target.value)
        }
      />
    </label>
  );

  return (
    <div className="quality-register-page">
      <style>{`
        .ncr-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .ncr-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #415849;
          font-size: 12px;
          font-weight: 700;
        }

        .ncr-field input,
        .ncr-field textarea,
        .ncr-field select {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #dce5de;
          border-radius: 6px;
          outline: none;
          background: white;
          color: #273c30;
          font: inherit;
          font-weight: 400;
        }

        .ncr-field input:focus,
        .ncr-field textarea:focus,
        .ncr-field select:focus {
          border-color: #568368;
          box-shadow: 0 0 0 2px rgba(64,116,82,.1);
        }

        .ncr-field textarea {
          min-height: 115px;
          resize: vertical;
        }

        .ncr-required {
          color: #b33d3d;
        }

        .ncr-full-width {
          grid-column: 1 / -1;
        }

        .ncr-section {
          margin-top: 25px;
          padding: 17px;
          border: 1px solid #dce4de;
          border-radius: 8px;
          background: #fff;
        }

        .ncr-section h3 {
          margin: 0 0 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e3e9e4;
          color: #284b37;
          font-size: 14px;
        }

        .ncr-activity-list {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 22px;
        }

        .ncr-activity-option {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #46564b;
          font-size: 12px;
          cursor: pointer;
        }

        .ncr-activity-option input {
          accent-color: #245440;
          width: 16px;
          height: 16px;
        }

        .ncr-file-input {
          display: block;
          width: 100%;
          padding: 12px;
          border: 1px dashed #9bb5a2;
          border-radius: 7px;
          background: #f5f9f6;
          color: #315b40;
          font-size: 12px;
        }

        .ncr-file-list {
          margin-top: 8px;
          color: #68766d;
          font-size: 11px;
        }

        .ncr-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .ncr-signature-note {
          margin-top: 7px;
          color: #859087;
          font-size: 10px;
          font-weight: 400;
        }

        .ncr-master-table {
          width: 100%;
          min-width: 950px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .ncr-master-table th {
          background: #eaf1ec;
          color: #294b38;
          padding: 13px 10px;
          text-align: left;
          border-bottom: 1px solid #d5dfd8;
          white-space: nowrap;
        }

        .ncr-master-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e8ede9;
          color: #46564b;
          vertical-align: top;
        }

        .ncr-master-table tbody tr:nth-child(even) {
          background: #fafcfb;
        }

        .ncr-factory-select {
          width: 100%;
          padding: 11px 12px;
          border: 1px solid #dce5de;
          border-radius: 6px;
          background: white;
          color: #273c30;
          outline: none;
        }

        @media(max-width:700px) {
          .ncr-form-grid {
            grid-template-columns: 1fr;
          }

          .ncr-full-width {
            grid-column: auto;
          }
        }

        @media print {
          .ncr-no-print {
            display: none !important;
          }

          .ncr-section {
            break-inside: avoid;
          }

          .ncr-form-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      {/* PAGE TOPBAR */}
      <div className="register-topbar">
        <div className="register-heading">
          <h1>Non-Conformance Management</h1>
          <p>Quality Management System · MS Q002 FORM 1</p>
        </div>

        <div className="register-actions">
          {activeView === "new" ? (
            <>
              <button
                type="button"
                className="register-btn"
                onClick={() => window.print()}
              >
                Print Form
              </button>

              <button
                type="button"
                className="register-btn primary"
                onClick={saveRecord}
                disabled={saving}
              >
                {saving ? "Saving..." : "Submit Report"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="register-btn"
              onClick={loadSavedRecords}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "↻ Refresh Records"}
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="register-tabs">
        <button
          type="button"
          className={`register-tab ${activeView === "new" ? "active" : ""}`}
          onClick={() => setActiveView("new")}
        >
          New Non-Conformance Report
        </button>

        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => setActiveView("master")}
        >
          Master NCR Register ({savedRecords.length})
        </button>
      </div>

      {/* NEW REPORT */}
      {activeView === "new" ? (
        <div className="register-paper">
          <div className="document-sheet">

            <div className="paper-heading">
              <div>
                <h2>Non-Conformance Report Form</h2>
                <p>
                  Record and report any identified non-conformance.
                  Complete all required fields.
                </p>
              </div>

              <span className="record-count">
                New Report
              </span>
            </div>

            {/* DOCUMENT HEADER */}
            <div className="document-header">
              <div className="logo-cell">
                <img
                  src="/images/mslogo.png"
                  alt="Maharaja's Spices"
                />
              </div>

              <div className="document-title">
                <strong>
                  Non-Conformance
                  <br />
                  Report Form
                </strong>
                <span>Quality Management System</span>
              </div>

              <div className="document-details">
                <div className="detail-row">
                  <div className="detail-label">Doc No.:</div>
                  <div className="detail-value">MS Q002 FORM 1</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Issue Date:</div>
                  <div className="detail-value">03/07/2023</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Version No.:</div>
                  <div className="detail-value">1</div>
                </div>

                <div className="detail-row">
                  <div className="detail-label">Rev Date:</div>
                  <div className="detail-value">14/01/2025</div>
                </div>
              </div>
            </div>

            <div className="approval-row">
              <div className="approval-label">Compiled By:</div>
              <div className="approval-value">As per controlled document</div>
              <div className="approval-label">Approved By:</div>
              <div className="approval-value">As per controlled document</div>
            </div>

            {/* SECTION 1 */}
            <div className="table-section-heading">
              <h3>SECTION 1 – To be completed by Reporting Party</h3>
              <span>Required fields marked with *</span>
            </div>

            <div className="ncr-section">
              <h3>General Information</h3>

              <div className="ncr-form-grid">

                <label className="ncr-field">
                  Factory *
                  <select
                    className="ncr-factory-select"
                    value={form.factory}
                    onChange={(event) => {
                      updateField(
                        "factory",
                        event.target.value as Factory
                      );
                      updateField("ncrNumber", "");
                    }}
                  >
                    <option value="Rockwood">Rockwood</option>
                    <option value="Nguni">Nguni</option>
                  </select>
                </label>

                {input(
                  "Originator Name",
                  "originatorName",
                  "text",
                  true
                )}

                {input(
                  "Product Description",
                  "productDescription",
                  "text",
                  true
                )}

                {input(
                  "Contractor / Supplier",
                  "contractorSupplier"
                )}

                {input(
                  "Batch Number",
                  "batchNumber"
                )}

                {input(
                  "Quantity",
                  "quantity"
                )}

                <div className="ncr-field">
                  <span>NCR Number</span>
                  <input
                    className="distribution-input"
                    value={form.ncrNumber}
                    placeholder="Automatically generated when submitted"
                    onChange={(event) =>
                      updateField("ncrNumber", event.target.value)
                    }
                  />
                </div>

              </div>
            </div>

            {/* ACTIVITY */}
            <div className="ncr-section">
              <h3>Found During Which Activity?</h3>

              <div className="ncr-activity-list">
                {ACTIVITY_OPTIONS.map((activity) => (
                  <label
                    className="ncr-activity-option"
                    key={activity}
                  >
                    <input
                      type="checkbox"
                      checked={form.activityFound.includes(activity)}
                      onChange={() => toggleActivity(activity)}
                    />
                    {activity}
                  </label>
                ))}
              </div>

              {form.activityFound.includes("Other") && (
                <div style={{ marginTop: 16 }}>
                  {input("Please Specify Other Activity", "otherActivity")}
                </div>
              )}
            </div>

            {/* PROBLEM DESCRIPTION */}
            <div className="ncr-section">
              <h3>Problem Description</h3>

              <div className="ncr-form-grid">
                <label className="ncr-field ncr-full-width">
                  Description of Non-Conformance *
                  <textarea
                    value={form.problemDescription}
                    onChange={(event) =>
                      updateField(
                        "problemDescription",
                        event.target.value
                      )
                    }
                    placeholder="Describe the non-conformance in detail..."
                  />
                </label>

                <div className="ncr-field ncr-full-width">
                  <span>Supporting Documents</span>

                  <input
                    className="ncr-file-input"
                    type="file"
                    multiple
                    onChange={(event) =>
                      setSelectedFiles(
                        Array.from(event.target.files || [])
                      )
                    }
                  />

                  {selectedFiles.length > 0 && (
                    <div className="ncr-file-list">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`}>
                          {file.name}
                        </div>
                      ))}

                      <p>
                        Files are selected locally. Supabase file
                        uploading still needs to be connected.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* IMMEDIATE ACTION */}
            <div className="ncr-section">
              <h3>Immediate Action Taken</h3>

              <label className="ncr-field">
                Describe the Immediate Action Taken
                <textarea
                  value={form.immediateAction}
                  onChange={(event) =>
                    updateField("immediateAction", event.target.value)
                  }
                  placeholder="Describe any immediate action taken to control the non-conformance..."
                />
              </label>
            </div>

            {/* SIGNATURE */}
            <div className="ncr-section">
              <h3>Occurrence and Reporting Party Sign-off</h3>

              <div className="ncr-form-grid">
                {input(
                  "Date of Occurrence",
                  "occurrenceDate",
                  "date",
                  true
                )}

                {input(
                  "Signature / Reporting Party Name",
                  "signature"
                )}

                {input(
                  "Signature Date",
                  "signatureDate",
                  "date"
                )}
              </div>

              <p className="ncr-signature-note">
                Enter the reporting party's name as a digital
                acknowledgement. This field is not an electronic
                signature verification.
              </p>
            </div>

            <div className="document-footer">
              <span>Doc No.: MS Q002 FORM 1</span>
              <span>Controlled Quality Document</span>
              <span>Version No.: 1</span>
            </div>

            <div className="ncr-form-actions ncr-no-print">
              <button
                type="button"
                className="register-btn"
                onClick={() => {
                  setForm(createEmptyForm());
                  setSelectedFiles([]);
                }}
              >
                Clear Form
              </button>

              <button
                type="button"
                className="register-btn primary"
                onClick={saveRecord}
                disabled={saving}
              >
                {saving ? "Saving Report..." : "Submit Non-Conformance Report"}
              </button>
            </div>

          </div>
        </div>
      ) : (

        /* MASTER REGISTER */
        <div className="register-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Non-Conformance Register</h2>
              <p>
                All Non-Conformance Reports submitted to the Quality
                Management System.
              </p>
            </div>

            <span className="record-count">
              {visibleRecords.length} Records
            </span>
          </div>

          <div
            className="register-filters ncr-no-print"
            style={{ marginBottom: 20 }}
          >
            <input
              className="register-search"
              placeholder="Search NCR, product, originator..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <select
              value={factoryFilter}
              onChange={(event) => setFactoryFilter(event.target.value)}
            >
              <option value="All">All Factories</option>
              <option value="Rockwood">Rockwood</option>
              <option value="Nguni">Nguni</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading Non-Conformance Reports...
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="empty-state">
              No Non-Conformance Reports found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="ncr-master-table">
                <thead>
                  <tr>
                    <th>NCR Number</th>
                    <th>Factory</th>
                    <th>Originator</th>
                    <th>Product Description</th>
                    <th>Batch Number</th>
                    <th>Date of Occurrence</th>
                    <th>Status</th>
                    <th>Date Submitted</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.record_number || "-"}</td>

                      <td>
                        <span className="factory-pill">
                          {record.factory}
                        </span>
                      </td>

                      <td>
                        {record.form_data?.originatorName || "-"}
                      </td>

                      <td>
                        {record.form_data?.productDescription || "-"}
                      </td>

                      <td>
                        {record.form_data?.batchNumber || "-"}
                      </td>

                      <td>
                        {record.form_data?.occurrenceDate || "-"}
                      </td>

                      <td>{record.status || "Submitted"}</td>

                      <td>
                        {record.created_at
                          ? new Date(record.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
