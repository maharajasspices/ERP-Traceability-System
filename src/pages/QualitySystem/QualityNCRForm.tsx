
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "./quality-system.css";

type Factory = "Rockwood" | "Nguni" | "";

type NCRFormData = {
  factory: Factory;
  originatorName: string;
  productDescription: string;
  batchNumber: string;
  quantity: string;
  contractorSupplier: string;
  ncrNumber: string;
  dateOfOccurrence: string;
  foundDuring: string;
  foundDuringOther: string;
  problemDescription: string;
  immediateAction: string;
  reportingSignature: string;
  reportingDate: string;

  criticality: string;
  disposition: string;
  dispositionOther: string;
  owner: string;
  dateAssigned: string;
  investigationDueDate: string;
  newNcrRequired: string;
  newNcrNumber: string;
  productionManagerName: string;
  productionManagerDate: string;
  productionManagerSignature: string;

  requiredAction: string;
  correctiveActionApproval: string;
  dispositionCompleted: string;
  completionEvidence: string;
  retestingResult: string;
  capaRcaFormNumber: string;
  ownerName: string;
  ownerDate: string;
  ownerSignature: string;

  qualityDesignee: string;
  closureComments: string;
  closureName: string;
  closureDate: string;
  closureSignature: string;
};

type SavedNCR = {
  id: number;
  record_number: string;
  factory: string;
  status: string;
  form_data: NCRFormData;
  created_at: string;
  orignatorName: string;
  productDescription: string;
  batchNumber: string;
  problemDescription: string;
  critically : string;
  ncrNumber: string;
  
};

const emptyForm = (): NCRFormData => ({
  factory: "",
  originatorName: "",
  productDescription: "",
  batchNumber: "",
  quantity: "",
  contractorSupplier: "",
  ncrNumber: "",
  dateOfOccurrence: "",
  foundDuring: "",
  foundDuringOther: "",
  problemDescription: "",
  immediateAction: "",
  reportingSignature: "",
  reportingDate: "",

  criticality: "",
  disposition: "",
  dispositionOther: "",
  owner: "",
  dateAssigned: new Date().toISOString().slice(0, 10),
  investigationDueDate: "",
  newNcrRequired: "",
  newNcrNumber: "",
  productionManagerName: "",
  productionManagerDate: "",
  productionManagerSignature: "",

  requiredAction: "",
  correctiveActionApproval: "",
  dispositionCompleted: "",
  completionEvidence: "",
  retestingResult: "",
  capaRcaFormNumber: "",
  ownerName: "",
  ownerDate: "",
  ownerSignature: "",

  qualityDesignee: "",
  closureComments: "",
  closureName: "",
  closureDate: "",
  closureSignature: "",
});

const addDays = (dateValue: string, days: number) => {
  if (!dateValue) return "";

  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const deadlineDays: Record<string, number> = {
  High: 10,
  "Medium/Moderate": 15,
  Low: 20,
};

export default function QualityNCRForm() {
  const [form, setForm] = useState<NCRFormData>(emptyForm());
  const [savedRecords, setSavedRecords] = useState<SavedNCR[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "master">("new");
  const [searchTerm, setSearchTerm] = useState("");

  const loadRecords = async () => {
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("fms_quality_records")
        .select("*")
        .eq("title", "Non-Conformance Report")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("NCR loading error:", error);
        alert("Could not load NCR records: " + error.message);
        return;
      }

      setSavedRecords(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const updateField = (field: keyof NCRFormData, value: string) => {
    setForm((previous) => {
      const updated = { ...previous, [field]: value };

      if (field === "criticality" || field === "dateAssigned") {
        const days = deadlineDays[updated.criticality];
        updated.investigationDueDate =
          days && updated.dateAssigned
            ? addDays(updated.dateAssigned, days)
            : "";
      }

      return updated;
    });
  };const generateNCRNumber = async (factory: Factory) => {
    const year = new Date().getFullYear();
    const suffix = factory === "Rockwood" ? "R" : "N";

    const { data, error } = await (supabase as any)
      .from("fms_quality_records")
      .select("record_number, form_data")
      .eq("title", "Non-Conformance Report")
      .eq("factory", factory.toLowerCase());

    
    if (error) throw error;
    let highestNumber = 0;
    (data || []).forEach((record: any) => {
      const number =
        record.form_data?.ncrNumber || record.record_number || "";
      const match = String(number).match(
        new RegExp(`NCR\\s*(\\d+)\\/${year}\\/${suffix}`, "i"),
      );

      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]));
      }
    });

    return `NCR ${String(highestNumber + 1).padStart(2, "0")}/${year}/${suffix}`;
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
      alert(
        "Please complete Originator Name, Product Description, Batch Number and Problem Description.",
      );
      return;
    }

    if (!form.criticality) {
      alert("Please select a Criticality Level in Section 2.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this NCR.");
        return;
      }

      const ncrNumber = await generateNCRNumber(form.factory);
      const finalForm = {
        ...form,
        ncrNumber,
      };

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Non-Conformance Report",
          record_number: ncrNumber,
          factory: form.factory.toLowerCase(),
          form_data: finalForm,
          status: "submitted",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        console.error("NCR save error:", error);
        alert("Could not save NCR: " + error.message);
        return;
      }

      alert(`Non-Conformance Report ${ncrNumber} saved successfully!`);
      setForm(emptyForm());
      await loadRecords();
      setActiveTab("master");
    } catch (error: any) {
      console.error("Unexpected NCR error:", error);
      alert(error?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = savedRecords.filter((record) => {
    const data = record.form_data || {};
    const searchable = [
      record.record_number,
      record.factory,
      data.factory,
      data.originatorName,
      data.productDescription,
      data.batchNumber,
      data.problemDescription,
      data.criticality,
      record.status,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchTerm.toLowerCase());
  });

  const factoryName = (value: string) => {
    if (value?.toLowerCase() === "rockwood") return "Rockwood";
    if (value?.toLowerCase() === "nguni") return "Nguni";
    return "-";
  };

  const inputClass = "ncr-input";
  const labelClass = "ncr-label";

  const textField = (
    label: string,
    field: keyof NCRFormData,
    type = "text",
    required = false,
  ) => (
    <label className="ncr-field">
      <span className={labelClass}>
        {label}{required ? " *" : ""}
      </span>
      <input
        className={inputClass}
        type={type}
        value={form[field]}
        required={required}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </label>
  );

  const textArea = (
    label: string,
    field: keyof NCRFormData,
    rows = 3,
  ) => (
    <label className="ncr-field ncr-full">
      <span className={labelClass}>{label}</span>
      <textarea
        className={inputClass}
        rows={rows}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </label>
  );

  const selectField = (
    label: string,
    field: keyof NCRFormData,
    options: string[],
    required = false,
  ) => (
    <label className="ncr-field">
      <span className={labelClass}>
        {label}{required ? " *" : ""}
      </span>
      <select
        className={inputClass}
        value={form[field]}
        required={required}
        onChange={(event) => updateField(field, event.target.value)}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  const sectionHeading = (number: number, title: string, subtitle: string) => (
    <div className="ncr-section-heading">
      <h3>SECTION {number}: {title}</h3>
      <p>{subtitle}</p>
    </div>
  );

  return (
    <div className="quality-register-page ncr-page">
      <style>{`
        .ncr-page .ncr-paper {
          background: #fff;
          border: 1px solid #d8ded8;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .ncr-page .ncr-document-header {
          display: grid;
          grid-template-columns: 150px 1fr 260px;
          border: 2px solid #253d2d;
          margin-bottom: 22px;
          min-height: 112px;
        }
        .ncr-page .ncr-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-right: 1px solid #253d2d;
        }
        .ncr-page .ncr-logo img {
          max-width: 125px;
          max-height: 80px;
          object-fit: contain;
        }
        .ncr-page .ncr-title {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 12px;
        }
        .ncr-page .ncr-title strong {
          font-size: 20px;
          color: #183d25;
          line-height: 1.25;
        }
        .ncr-page .ncr-title span {
          font-size: 11px;
          margin-top: 6px;
        }
        .ncr-page .ncr-details {
          border-left: 1px solid #253d2d;
          font-size: 11px;
        }
        .ncr-page .ncr-detail-row {
          display: grid;
          grid-template-columns: 100px 1fr;
          border-bottom: 1px solid #ddd;
          min-height: 27px;
        }
        .ncr-page .ncr-detail-row:last-child {
          border-bottom: 0;
        }
        .ncr-page .ncr-detail-row strong,
        .ncr-page .ncr-detail-row span {
          padding: 6px;
        }
        .ncr-page .ncr-detail-row strong {
          background: #f1f5f1;
          border-right: 1px solid #ddd;
        }
        .ncr-page .ncr-section-heading {
          background: #eaf1eb;
          border-left: 4px solid #28613a;
          padding: 10px 14px;
          margin: 22px 0 14px;
        }
        .ncr-page .ncr-section-heading h3 {
          color: #19472a;
          font-weight: 700;
          font-size: 14px;
          margin: 0;
        }
        .ncr-page .ncr-section-heading p {
          color: #5c6d60;
          font-size: 11px;
          margin: 4px 0 0;
        }
        .ncr-page .ncr-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .ncr-page .ncr-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .ncr-page .ncr-full {
          grid-column: 1 / -1;
        }
        .ncr-page .ncr-label {
          font-size: 12px;
          font-weight: 600;
          color: #344b39;
        }
        .ncr-page .ncr-input {
          width: 100%;
          min-height: 38px;
          border: 1px solid #cbd5cc;
          border-radius: 5px;
          padding: 8px 10px;
          background: white;
          color: #243329;
          font-size: 13px;
        }
        .ncr-page textarea.ncr-input {
          resize: vertical;
          min-height: 75px;
        }
        .ncr-page .ncr-choice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          padding: 10px 0;
        }
        .ncr-page .ncr-choice-row label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
        }
        .ncr-page .ncr-signature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }
        .ncr-page .ncr-page-break {
          page-break-before: always;
          break-before: page;
          margin-top: 30px;
        }
        .ncr-page .ncr-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid #b9c6ba;
          margin-top: 24px;
          padding-top: 9px;
          font-size: 10px;
          color: #56675a;
        }
        .ncr-page .ncr-master-wrap {
          overflow-x: auto;
        }
        .ncr-page .ncr-master-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
          font-size: 12px;
        }
        .ncr-page .ncr-master-table th {
          background: #eaf1eb;
          color: #21482c;
          text-align: left;
          padding: 11px 9px;
          border: 1px solid #d5dfd6;
        }
        .ncr-page .ncr-master-table td {
          padding: 10px 9px;
          border: 1px solid #e0e6e1;
        }
        .ncr-page .ncr-master-table tr:nth-child(even) {
          background: #f8faf8;
        }
        @media(max-width: 700px) {
          .ncr-page .ncr-document-header {
            grid-template-columns: 1fr;
          }
          .ncr-page .ncr-logo,
          .ncr-page .ncr-details {
            border: 0;
          }
          .ncr-page .ncr-grid,
          .ncr-page .ncr-signature-grid {
            grid-template-columns: 1fr;
          }
          .ncr-page .ncr-full {
            grid-column: auto;
          }
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          .ncr-page .register-topbar,
          .ncr-page .register-tabs,
          .ncr-page .no-print {
            display: none !important;
          }
          .ncr-page,
          .ncr-page .ncr-paper {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .ncr-page .ncr-page-break {
            page-break-before: always;
            break-before: page;
          }
          .ncr-page .ncr-input {
            border: 0;
            border-bottom: 1px solid #999;
            border-radius: 0;
            padding-left: 2px;
          }
          .ncr-page textarea.ncr-input {
            border: 1px solid #999;
          }
        }
      `}</style>

      <div className="register-topbar">
        <div className="register-heading">
          <h1>Non-Conformance Report</h1>
          <p>Quality Management System · MS Q002 FORM 1</p>
        </div>

        <div className="register-actions no-print">
          {activeTab === "new" ? (
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
              {loading ? "Refreshing..." : "↻ Refresh Records"}
            </button>
          )}
        </div>
      </div>

      <div className="register-tabs no-print">
        <button
          type="button"
          className={`register-tab ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          New Non-Conformance Report
        </button>

        <button
          type="button"
          className={`register-tab ${activeTab === "master" ? "active" : ""}`}
          onClick={() => setActiveTab("master")}
        >
          Master NCR Register ({savedRecords.length})
        </button>
      </div>

      {activeTab === "new" ? (
        <div className="ncr-paper">
          <div className="ncr-document-header">
            <div className="ncr-logo">
              <img src="/images/mslogo.png" alt="Maharaja's Spices" />
            </div>

            <div className="ncr-title">
              <strong>NON-CONFORMANCE<br />REPORT FORM</strong>
              <span>Quality Management System</span>
            </div>

            <div className="ncr-details">
              <div className="ncr-detail-row">
                <strong>Doc No.:</strong>
                <span>MS Q002 FORM 1</span>
              </div>
              <div className="ncr-detail-row">
                <strong>Issue Date:</strong>
                <span>03/07/2023</span>
              </div>
              <div className="ncr-detail-row">
                <strong>Version No.:</strong>
                <span>1</span>
              </div>
              <div className="ncr-detail-row">
                <strong>Rev Date:</strong>
                <span>14/01/2025</span>
              </div>
            </div>
          </div>

          <div className="ncr-section-heading">
            <h3>SECTION 1: Reporting Party</h3>
            <p>To be completed by the Reporting Party</p>
          </div>

          <div className="ncr-grid">
            <label className="ncr-field">
              <span className="ncr-label">Factory *</span>
              <select
                className="ncr-input"
                value={form.factory}
                onChange={(event) => {
                  const factory = event.target.value as Factory;
                  updateField("factory", factory);
                }}
                required
              >
                <option value="">Select factory...</option>
                <option value="Rockwood">Rockwood</option>
                <option value="Nguni">Nguni</option>
              </select>
            </label>

            {textField("Originator Name", "originatorName", "text", true)}
            {textField("Product Description", "productDescription", "text", true)}
            {textField("Batch Number", "batchNumber", "text", true)}
            {textField("Qty", "quantity")}
            {textField("Contractor/Supplier", "contractorSupplier")}
            <label className="ncr-field">
              <span className="ncr-label">NCR Number</span>
              <input
                className="ncr-input"
                value={form.ncrNumber || "Generated automatically when saved"}
                readOnly
              />
            </label>
            {textField("Date of Occurrence", "dateOfOccurrence", "date")}
          </div>

          <div className="ncr-field" style={{ marginTop: 16 }}>
            <span className="ncr-label">Found During What Activity?</span>
            <div className="ncr-choice-row">
              {["Incoming Inspection", "In-process Inspection", "Final Inspection", "Other"].map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="foundDuring"
                    checked={form.foundDuring === option}
                    onChange={() => updateField("foundDuring", option)}
                  />
                  {option}
                </label>
              ))}
            </div>
            {form.foundDuring === "Other" &&
              textField("Specify Other Activity", "foundDuringOther")}
          </div>

          <div className="ncr-grid" style={{ marginTop: 14 }}>
            {textArea("Problem Description (attach any supporting documents)", "problemDescription", 4)}
            {textArea("Immediate Action Taken", "immediateAction", 4)}
          </div>

          <div className="ncr-signature-grid">
            {textField("Reporting Party Signature", "reportingSignature")}
            {textField("Date", "reportingDate", "date")}
          </div>

          <div className="ncr-footer">
            <span>Doc No.: MS Q002 FORM 1</span>
            <span>Page 1 of 2</span>
            <span>Version No.: 1</span>
          </div>

          <div className="ncr-page-break">
            <div className="ncr-document-header">
              <div className="ncr-logo">
                <img src="/images/mslogo.png" alt="Maharaja's Spices" />
              </div>

              <div className="ncr-title">
                <strong>NON-CONFORMANCE<br />REPORT FORM</strong>
                <span>Quality Management System</span>
              </div>

              <div className="ncr-details">
                <div className="ncr-detail-row">
                  <strong>Doc No.:</strong>
                  <span>MS Q002 FORM 1</span>
                </div>
                <div className="ncr-detail-row">
                  <strong>Issue Date:</strong>
                  <span>03/07/2023</span>
                </div>
                <div className="ncr-detail-row">
                  <strong>Version No.:</strong>
                  <span>1</span>
                </div>
                <div className="ncr-detail-row">
                  <strong>Rev Date:</strong>
                  <span>14/01/2025</span>
                </div>
              </div>
            </div>

            {sectionHeading(2, "Production Manager", "To be completed by the Production Manager")}

            <div className="ncr-grid">
              {selectField("Criticality Level", "criticality", [
                "High",
                "Medium/Moderate",
                "Low",
              ], true)}

              {selectField("Disposition", "disposition", [
                "Use-as-is",
                "Rework",
                "Return to supplier",
                "Repair",
                "Reject",
                "Other",
              ])}

              {form.disposition === "Other" &&
                textField("Specify Other Disposition", "dispositionOther")}

              {textField("Owner", "owner")}
              {textField("Date Assigned", "dateAssigned", "date")}
              {textField("Investigation Due Date", "investigationDueDate", "date")}
            </div>

            {form.criticality && (
              <p style={{ fontSize: 12, color: "#285d37", marginTop: 10 }}>
                Investigation deadline: {deadlineDays[form.criticality]} days
                from the date assigned.
              </p>
            )}

            <div className="ncr-field" style={{ marginTop: 16 }}>
              <span className="ncr-label">
                Planned Disposition has been completed and Corrective Action has been initiated?
              </span>
              <div className="ncr-choice-row">
                {["Yes", "No"].map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="dispositionCompleted"
                      checked={form.dispositionCompleted === option}
                      onChange={() => updateField("dispositionCompleted", option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="ncr-grid">
              {textField("Production Manager Name", "productionManagerName")}
              {textField("Date", "productionManagerDate", "date")}
              {textField("Signature", "productionManagerSignature")}
              <label className="ncr-field">
                <span className="ncr-label">New NCR Required?</span>
                <select
                  className="ncr-input"
                  value={form.newNcrRequired}
                  onChange={(event) => updateField("newNcrRequired", event.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
              {form.newNcrRequired === "Yes" &&
                textField("New NCR Number", "newNcrNumber")}
            </div>

            {sectionHeading(3, "Owner Investigation", "To be completed by the Owner and returned to the Production Manager for review prior to the due date")}

            <div className="ncr-grid">
              {textArea("Required Action", "requiredAction", 4)}
              {textArea("Retesting of Product Result", "retestingResult", 3)}
              {textField("CAPA & RCA Form No. Issued", "capaRcaFormNumber")}
              {textField("Owner Name", "ownerName")}
              {textField("Date", "ownerDate", "date")}
              {textField("Signature", "ownerSignature")}
            </div>

            <div className="ncr-field" style={{ marginTop: 16 }}>
              <span className="ncr-label">
                Approval of Corrective/Preventative Action
              </span>
              <div className="ncr-choice-row">
                {["Yes", "No"].map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="correctiveActionApproval"
                      checked={form.correctiveActionApproval === option}
                      onChange={() => updateField("correctiveActionApproval", option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            {textArea("Attach Proof of Completion / Supporting Evidence", "completionEvidence", 3)}

            {sectionHeading(4, "Closing the Non-Conformance", "To be completed by the Quality Designee or Other (specify)")}

            <div className="ncr-grid">
              {selectField("Completed By", "qualityDesignee", [
                "Quality Designee",
                "Other",
              ])}
              {textField("If Other, Specify", "closureComments")}
              {textField("Name", "closureName")}
              {textField("Date", "closureDate", "date")}
              {textField("Signature", "closureSignature")}
            </div>

            <div className="ncr-footer">
              <span>Doc No.: MS Q002 FORM 1</span>
              <span>Page 2 of 2</span>
              <span>Version No.: 1</span>
            </div>
          </div>

          <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <button
              type="button"
              className="register-btn primary"
              onClick={saveNCR}
              disabled={saving}
            >
              {saving ? "Saving NCR..." : "Save Non-Conformance Report"}
            </button>
          </div>
        </div>
      ) : (
        <div className="ncr-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Non-Conformance Register</h2>
              <p>All saved Non-Conformance Reports for Rockwood and Nguni.</p>
            </div>
            <span className="record-count">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="register-filters no-print" style={{ marginBottom: 20 }}>
            <input
              className="register-search"
              placeholder="Search NCR number, factory, product, batch or owner..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty-state">Loading NCR records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">No NCR records found.</div>
          ) : (
            <div className="ncr-master-wrap">
              <table className="ncr-master-table">
                <thead>
                  <tr>
                    <th>NCR Number</th>
                    <th>Factory</th>
                    <th>Date Occurred</th>
                    <th>Originator</th>
                    <th>Product</th>
                    <th>Batch Number</th>
                    <th>Criticality</th>
                    <th>Investigation Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const data = record.form_data || {};

                    return (
                      <tr key={record.id}>
                        <td>{record.record_number || data.ncrNumber || "-"}</td>
                        <td>{factoryName(record.factory || data.factory)}</td>
                        <td>{data.dateOfOccurrence || "-"}</td>
                        <td>{data.originatorName || "-"}</td>
                        <td>{data.productDescription || "-"}</td>
                        <td>{data.batchNumber || "-"}</td>
                        <td>{data.criticality || "-"}</td>
                        <td>{data.investigationDueDate || "-"}</td>
                        <td>{record.status || "Submitted"}</td>
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
