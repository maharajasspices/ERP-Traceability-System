
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DistributionEntry = {
  id: number;
  factory: "Rockwood" | "Nguni";
  documentNo: string;
  versionNo: string;
  distributedTo: string;
  date: string;
  recipientSign: string;
  withdrawnOn: string;
  controllerSign: string;
};

type SavedEntry = {
  id: number;
  record_number: string;
  factory: string;
  form_data: Record<string, any>;
  created_at: string;
};

const createEmptyEntry = (id: number): DistributionEntry => ({
  id,
  factory: "Rockwood",
  documentNo: "",
  versionNo: "",
  distributedTo: "",
  date: "",
  recipientSign: "",
  withdrawnOn: "",
  controllerSign: "",
});

export default function QualityMasterSheets() {
  const [entries, setEntries] = useState<DistributionEntry[]>([
    createEmptyEntry(1),
  ]);
  const [nextId, setNextId] = useState(2);
  const [factoryFilter, setFactoryFilter] = useState("All");
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
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
        .eq("title", "Document Control Distribution List")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading distribution entries:", error);
        alert("Could not load saved distribution entries: " + error.message);
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
    field: keyof DistributionEntry,
    value: string
  ) => {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const saveEntry = async (
    event: React.MouseEvent<HTMLButtonElement>,
    entryId: number
  ) => {
    if (savingId !== null) return;

    const row = event.currentTarget.closest("tr");

    if (!row) {
      alert("Could not find the distribution row.");
      return;
    }

    const getValue = (field: string): string =>
      row
        .querySelector<HTMLInputElement>(`input[data-field="${field}"]`)
        ?.value?.trim() || "";

    const documentNo = getValue("documentNo");
    const distributedTo = getValue("distributedTo");
    const versionNo = getValue("versionNo");
    const date = getValue("date");
    const recipientSign = getValue("recipientSign");
    const withdrawnOn = getValue("withdrawnOn");
    const controllerSign = getValue("controllerSign");

    const factorySelect = row.querySelector<HTMLSelectElement>(
      ".factory-editor select"
    );

    const factory =
      factorySelect?.value === "Nguni" ? "Nguni" : "Rockwood";

    if (!documentNo || !distributedTo) {
      alert(
        `Please complete the required fields.\n\nDocument No.: ${
          documentNo || "EMPTY"
        }\nDistributed To: ${distributedTo || "EMPTY"}`
      );
      return;
    }

    setSavingId(entryId);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("You must be logged in to save this entry.");
        return;
      }

      const { error } = await (supabase as any)
        .from("fms_quality_records")
        .insert({
          title: "Document Control Distribution List",
          record_number: `DCD-${Date.now()}`,
          factory: factory.toLowerCase(),
          form_data: {
            documentNo,
            versionNo,
            distributedTo,
            date,
            recipientSign,
            withdrawnOn,
            controllerSign,
          },
          status: "submitted",
          created_by: authData.user.id,
          updated_by: authData.user.id,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        console.error("SUPABASE SAVE ERROR:", error);
        alert("Could not save entry: " + error.message);
        return;
      }

      alert("Distribution entry saved successfully!");

      setEntries((previous) =>
        previous.map((entry) =>
          entry.id === entryId ? createEmptyEntry(entry.id) : entry
        )
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

    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  };

  const visibleEntries = entries.filter(
    (entry) =>
      factoryFilter === "All" || entry.factory === factoryFilter
  );

  const visibleSavedEntries = savedEntries.filter((entry) => {
    const matchesFactory =
      factoryFilter === "All" ||
      entry.factory?.toLowerCase() === factoryFilter.toLowerCase();

    const formData = entry.form_data || {};

    const searchText = [
      formData.documentNo,
      formData.distributedTo,
      formData.versionNo,
      entry.record_number,
      entry.factory,
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesFactory &&
      searchText.includes(searchTerm.toLowerCase())
    );
  });

  const cellInput = (
    value: string,
    onChange: (value: string) => void,
    fieldName: string,
    type = "text",
    placeholder = ""
  ) => (
    <input
      type={type}
      value={value}
      data-field={fieldName}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="distribution-input"
    />
  );

  return (
    <div className="quality-register-page">
      <style>{`
        .quality-register-page {
          min-height: 100vh;
          padding: 28px;
          color: #25302b;
          background: #f3f5f3;
          font-family: Arial, Helvetica, sans-serif;
        }

        .register-topbar {
          max-width: 1450px;
          margin: 0 auto 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
        }

        .register-heading h1 {
          margin: 0;
          font-size: 25px;
          font-weight: 750;
          color: #183d30;
          letter-spacing: -.5px;
        }

        .register-heading p {
          margin: 6px 0 0;
          color: #758079;
          font-size: 13px;
        }

        .register-actions,
        .register-tabs,
        .register-filters {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        .register-btn {
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid #d5ded8;
          background: white;
          color: #345044;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: .2s;
        }

        .register-btn:hover {
          background: #edf3ef;
          border-color: #9eafa4;
        }

        .register-btn.primary {
          background: #245440;
          border-color: #245440;
          color: white;
        }

        .register-btn.primary:hover {
          background: #193e2e;
        }

        .register-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .register-btn.danger {
          color: #a33c3c;
          border-color: #efdada;
          padding: 7px 10px;
        }

        .register-btn.danger:hover {
          background: #fff0f0;
        }

        .register-tabs {
          max-width: 1450px;
          margin: 0 auto 18px;
          border-bottom: 1px solid #dce3de;
          gap: 5px;
        }

        .register-tab {
          border: none;
          background: transparent;
          color: #7a867e;
          padding: 12px 17px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 650;
          border-bottom: 3px solid transparent;
        }

        .register-tab.active {
          color: #245440;
          border-bottom-color: #245440;
        }

        .register-paper {
          width: 100%;
          max-width: 1450px;
          margin: 0 auto;
          background: white;
          border: 1px solid #e1e7e2;
          border-radius: 13px;
          padding: 26px;
          box-shadow: 0 5px 22px rgba(29, 55, 40, .055);
          overflow-x: auto;
        }

        .paper-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .paper-heading h2 {
          color: #244c38;
          font-size: 17px;
          margin: 0;
          font-weight: 750;
        }

        .paper-heading p {
          color: #849087;
          font-size: 12px;
          margin: 5px 0 0;
        }

        .record-count {
          background: #edf4ef;
          color: #315b43;
          padding: 7px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .document-sheet {
          max-width: 1120px;
          margin: 0 auto;
          font-family: Arial, Helvetica, sans-serif;
          color: #1d2822;
        }

        .document-header {
          display: grid;
          grid-template-columns: 30% 40% 30%;
          min-height: 105px;
          border: 1.5px solid #263c30;
          border-radius: 8px 8px 0 0;
          overflow: hidden;
        }

        .logo-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          background: white;
          border-right: 1px solid #d9e0db;
        }

        .logo-cell img {
          max-width: 95%;
          max-height: 78px;
          object-fit: contain;
        }

        .document-title {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 12px;
          background: #214b36;
          color: white;
        }

        .document-title strong {
          font-size: 18px;
          line-height: 1.4;
          letter-spacing: .3px;
        }

        .document-title span {
          font-size: 10px;
          margin-top: 6px;
          color: #dce9df;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }

        .document-details {
          display: grid;
          grid-template-rows: repeat(4, 1fr);
          font-size: 10px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 44% 56%;
          border-bottom: 1px solid #e0e5e1;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          background: #f0f4f1;
          padding: 7px;
          color: #526358;
          font-weight: 650;
          border-right: 1px solid #e0e5e1;
        }

        .detail-value {
          padding: 7px;
          font-weight: 700;
          color: #263d30;
        }

        .approval-row {
          display: grid;
          grid-template-columns: 17% 33% 17% 33%;
          border: 1.5px solid #263c30;
          border-top: none;
          font-size: 11px;
        }

        .approval-label,
        .approval-value {
          padding: 9px 8px;
          border-right: 1px solid #dce3de;
        }

        .approval-label {
          background: #edf3ef;
          font-weight: 700;
          color: #415849;
        }

        .approval-value {
          color: #293d31;
        }

        .approval-value:last-child {
          border-right: none;
        }

        .table-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 25px 0 11px;
          gap: 10px;
        }

        .table-section-heading h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 750;
          color: #284b37;
        }

        .table-section-heading span {
          font-size: 11px;
          color: #859087;
        }

        .table-scroll {
          overflow-x: auto;
          border: 1px solid #dce4de;
          border-radius: 8px;
        }

        .register-table {
          width: 100%;
          min-width: 980px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          font-size: 11px;
        }

        .register-table th {
          background: #eaf1ec;
          color: #294b38;
          font-weight: 750;
          padding: 12px 7px;
          text-align: center;
          border-right: 1px solid #d5dfd8;
          border-bottom: 1px solid #cbd8cf;
          line-height: 1.4;
        }

        .register-table th:first-child {
          border-radius: 7px 0 0 0;
        }

        .register-table th:last-child {
          border-right: none;
          border-radius: 0 7px 0 0;
        }

        .register-table td {
          height: 65px;
          padding: 7px;
          text-align: center;
          vertical-align: middle;
          border-right: 1px solid #e3e9e4;
          border-bottom: 1px solid #e3e9e4;
          background: white;
        }

        .register-table tbody tr:nth-child(even) td {
          background: #fafcfb;
        }

        .register-table td:last-child {
          border-right: none;
        }

        .distribution-input {
          display: block;
          width: 100%;
          min-width: 0;
          padding: 9px 6px;
          border: 1px solid #dce5de;
          border-radius: 5px;
          outline: none;
          background: white;
          color: #273c30;
          text-align: center;
          font: inherit;
          font-size: 11px;
          transition: .2s;
        }

        .distribution-input:focus {
          border-color: #568368;
          box-shadow: 0 0 0 2px rgba(64, 116, 82, .1);
        }

        .distribution-input::placeholder {
          color: #a5afa8;
        }

        .factory-editor {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-bottom: 7px;
          font-size: 10px;
          font-weight: 700;
          color: #718078;
        }

        .factory-editor select {
          width: 100%;
          padding: 7px 5px;
          border: 1px solid #d4dfd7;
          border-radius: 5px;
          background: #f7faf8;
          color: #31533d;
          font-size: 11px;
          font-weight: 650;
          outline: none;
        }

        .row-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .save-row-btn {
          width: 100%;
          padding: 8px 5px;
          background: #245440;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .save-row-btn:hover {
          background: #193e2e;
        }

        .save-row-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .remove-row-btn {
          padding: 4px 5px;
          color: #a14c4c;
          border: none;
          background: transparent;
          font-size: 10px;
          cursor: pointer;
        }

        .remove-row-btn:hover {
          text-decoration: underline;
        }

        .add-row-area {
          display: flex;
          justify-content: center;
          padding: 17px 0 4px;
        }

        .add-row-btn {
          border: 1px dashed #9bb5a2;
          background: #f5f9f6;
          color: #315b40;
          padding: 10px 20px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .add-row-btn:hover {
          background: #eaf3ec;
          border-color: #63866c;
        }

        .document-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 35px;
          padding-top: 10px;
          border-top: 1px solid #dce3de;
          color: #68766d;
          font-size: 9px;
          font-weight: 650;
        }

        .register-filters select,
        .register-search {
          padding: 10px 12px;
          border: 1px solid #d8e1da;
          border-radius: 7px;
          outline: none;
          background: white;
          color: #34483a;
          font-size: 12px;
        }

        .register-search {
          min-width: 260px;
        }

        .register-filters select:focus,
        .register-search:focus {
          border-color: #6c9678;
        }

        .master-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
          font-size: 12px;
        }

        .master-table th {
          background: #eaf1ec;
          color: #294b38;
          padding: 13px 10px;
          text-align: left;
          font-weight: 750;
          border-bottom: 1px solid #d5dfd8;
          white-space: nowrap;
        }

        .master-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e8ede9;
          color: #46564b;
        }

        .master-table tbody tr:nth-child(even) {
          background: #fafcfb;
        }

        .factory-pill {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          background: #edf4ef;
          color: #315b40;
          font-size: 10px;
          font-weight: 750;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #859087;
          font-size: 13px;
        }

        @media (max-width: 800px) {
          .quality-register-page {
            padding: 15px;
          }

          .register-paper {
            padding: 16px;
          }

          .document-header {
            grid-template-columns: 1fr 1.2fr;
          }

          .document-details {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, auto);
          }

          .approval-row {
            grid-template-columns: 25% 25% 25% 25%;
            font-size: 9px;
          }

          .register-heading h1 {
            font-size: 21px;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 9mm;
          }

          body {
            background: white !important;
          }

          .quality-register-page {
            padding: 0;
            background: white;
          }

          .register-topbar,
          .register-tabs,
          .no-print,
          .add-row-area,
          .row-actions,
          .factory-editor {
            display: none !important;
          }

          .register-paper {
            max-width: none;
            padding: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            overflow: visible;
          }

          .document-sheet {
            max-width: none;
          }

          .document-header {
            min-height: 75px;
          }

          .logo-cell img {
            max-height: 58px;
          }

          .register-table {
            min-width: 0;
            font-size: 9px;
          }

          .register-table th {
            padding: 7px 4px;
          }

          .register-table td {
            height: 34px;
            padding: 4px;
          }

          .distribution-input {
            border: none;
            box-shadow: none;
            padding: 3px;
            color: black;
            background: transparent;
          }

          .document-footer {
            margin-top: 25px;
          }

          .register-table tr {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="register-topbar">
        <div className="register-heading">
          <h1>Document Control</h1>
          <p>Quality Management System · MS Q001 LOG 2</p>
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
          New Distribution Entry
        </button>

        <button
          type="button"
          className={`register-tab ${activeView === "master" ? "active" : ""}`}
          onClick={() => setActiveView("master")}
        >
          Master Distribution Register ({savedEntries.length})
        </button>
      </div>

      {activeView === "new" ? (
        <div className="register-paper">
          <div className="document-sheet">
            <div className="paper-heading">
              <div>
                <h2>Document Distribution Record</h2>
                <p>
                  Complete the details below. Add another row when you need
                  to distribute an additional document.
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
                  Document Control
                  <br />
                  Distribution List
                </strong>
                <span>Quality Management System</span>
              </div>

              <div className="document-details">
                <div className="detail-row">
                  <div className="detail-label">Doc No.:</div>
                  <div className="detail-value">MS Q001 LOG 2</div>
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
                  <div className="detail-value">17/02/2025</div>
                </div>
              </div>
            </div>

            <div className="approval-row">
              <div className="approval-label">Compiled By:</div>
              <div className="approval-value">Tania Naicker</div>
              <div className="approval-label">Approved By:</div>
              <div className="approval-value">Livinia Govender</div>
            </div>

            <div className="table-section-heading">
              <h3>Distribution Entries</h3>
              <span>Required fields: Document No. and Distributed To</span>
            </div>

            <div className="table-scroll">
              <table className="register-table">
                <colgroup>
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Document No.</th>
                    <th>Version No.</th>
                    <th>Distributed To</th>
                    <th>Date</th>
                    <th>Recipient Sign</th>
                    <th>Withdrawn On</th>
                    <th>Document Controller Sign</th>
                    <th className="no-print">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="factory-editor">
                          <label>Factory</label>
                          <select
                            value={entry.factory}
                            onChange={(event) =>
                              updateEntry(
                                entry.id,
                                "factory",
                                event.target.value
                              )
                            }
                          >
                            <option value="Rockwood">Rockwood</option>
                            <option value="Nguni">Nguni</option>
                          </select>
                        </div>

                        {cellInput(
                          entry.documentNo,
                          (v) => updateEntry(entry.id, "documentNo", v),
                          "documentNo",
                          "text",
                          "Document No."
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.versionNo,
                          (v) => updateEntry(entry.id, "versionNo", v),
                          "versionNo",
                          "text",
                          "Version"
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.distributedTo,
                          (v) => updateEntry(entry.id, "distributedTo", v),
                          "distributedTo",
                          "text",
                          "Recipient / Department"
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.date,
                          (v) => updateEntry(entry.id, "date", v),
                          "date",
                          "date"
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.recipientSign,
                          (v) => updateEntry(entry.id, "recipientSign", v),
                          "recipientSign",
                          "text",
                          "Signature"
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.withdrawnOn,
                          (v) => updateEntry(entry.id, "withdrawnOn", v),
                          "withdrawnOn",
                          "date"
                        )}
                      </td>

                      <td>
                        {cellInput(
                          entry.controllerSign,
                          (v) => updateEntry(entry.id, "controllerSign", v),
                          "controllerSign",
                          "text",
                          "Signature"
                        )}
                      </td>

                      <td className="no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="save-row-btn"
                            disabled={savingId !== null}
                            onClick={(event) =>
                              saveEntry(event, entry.id)
                            }
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
              <span>Doc No.: MS Q001 LOG 2</span>
              <span>Controlled Quality Document</span>
              <span>Version No.: 1</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="register-paper">
          <div className="paper-heading">
            <div>
              <h2>Master Distribution Register</h2>
              <p>All distribution records saved in the Quality System.</p>
            </div>
            <span className="record-count">
              {visibleSavedEntries.length} records
            </span>
          </div>

          <div className="register-filters" style={{ marginBottom: 20 }}>
            <input
              className="register-search"
              placeholder="Search document number or recipient..."
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
            <div className="empty-state">Loading saved distribution records...</div>
          ) : visibleSavedEntries.length === 0 ? (
            <div className="empty-state">
              No matching distribution entries found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Factory</th>
                    <th>Document No.</th>
                    <th>Version</th>
                    <th>Distributed To</th>
                    <th>Date</th>
                    <th>Recipient Sign</th>
                    <th>Withdrawn On</th>
                    <th>Controller Sign</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleSavedEntries.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <span className="factory-pill">
                          {record.factory}
                        </span>
                      </td>
                      <td>{record.form_data?.documentNo || "-"}</td>
                      <td>{record.form_data?.versionNo || "-"}</td>
                      <td>{record.form_data?.distributedTo || "-"}</td>
                      <td>{record.form_data?.date || "-"}</td>
                      <td>{record.form_data?.recipientSign || "-"}</td>
                      <td>{record.form_data?.withdrawnOn || "-"}</td>
                      <td>{record.form_data?.controllerSign || "-"}</td>
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
