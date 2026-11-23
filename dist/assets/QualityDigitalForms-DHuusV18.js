import{r as u,j as e,s as v,aE as W}from"./index-BRSYiF7l.js";const P=a=>({id:a,factory:"Rockwood",documentNo:"",versionNo:"",distributedTo:"",date:"",recipientSign:"",withdrawnOn:"",controllerSign:""});function K(){const[a,m]=u.useState([P(1)]),[f,S]=u.useState(2),[N,E]=u.useState("All"),[w,R]=u.useState([]),[b,C]=u.useState(!0),[j,O]=u.useState(null),[x,y]=u.useState("new"),[k,h]=u.useState(""),A=async()=>{C(!0);try{const{data:r,error:n}=await v.from("fms_quality_records").select("*").eq("title","Document Control Distribution List").order("created_at",{ascending:!1});if(n){console.error("Error loading distribution entries:",n),alert("Could not load saved distribution entries: "+n.message);return}R(r||[])}finally{C(!1)}};u.useEffect(()=>{A()},[]);const c=(r,n,l)=>{m(p=>p.map(g=>g.id===r?{...g,[n]:l}:g))},D=async(r,n)=>{if(j!==null)return;const l=r.currentTarget.closest("tr");if(!l){alert("Could not find the distribution row.");return}const p=L=>{var M,q;return((q=(M=l.querySelector(`input[data-field="${L}"]`))==null?void 0:M.value)==null?void 0:q.trim())||""},g=p("documentNo"),T=p("distributedTo"),_=p("versionNo"),Q=p("date"),U=p("recipientSign"),Y=p("withdrawnOn"),G=p("controllerSign"),I=l.querySelector(".factory-editor select"),H=(I==null?void 0:I.value)==="Nguni"?"Nguni":"Rockwood";if(!g||!T){alert(`Please complete the required fields.

Document No.: ${g||"EMPTY"}
Distributed To: ${T||"EMPTY"}`);return}O(n);try{const{data:L,error:M}=await v.auth.getUser();if(M||!L.user){alert("You must be logged in to save this entry.");return}const{error:q}=await v.from("fms_quality_records").insert({title:"Document Control Distribution List",record_number:`DCD-${Date.now()}`,factory:H.toLowerCase(),form_data:{documentNo:g,versionNo:_,distributedTo:T,date:Q,recipientSign:U,withdrawnOn:Y,controllerSign:G},status:"submitted",created_by:L.user.id,updated_by:L.user.id,submitted_at:new Date().toISOString()});if(q){console.error("SUPABASE SAVE ERROR:",q),alert("Could not save entry: "+q.message);return}alert("Distribution entry saved successfully!"),m(X=>X.map(F=>F.id===n?P(F.id):F)),await A()}catch(L){console.error("Unexpected save error:",L),alert("An unexpected error occurred while saving.")}finally{O(null)}},o=()=>{m(r=>[...r,P(f)]),S(r=>r+1)},d=r=>{if(a.length===1){alert("You must keep at least one entry row.");return}m(n=>n.filter(l=>l.id!==r))},i=a.filter(r=>N==="All"||r.factory===N),t=w.filter(r=>{var g;const n=N==="All"||((g=r.factory)==null?void 0:g.toLowerCase())===N.toLowerCase(),l=r.form_data||{},p=[l.documentNo,l.distributedTo,l.versionNo,r.record_number,r.factory].join(" ").toLowerCase();return n&&p.includes(k.toLowerCase())}),s=(r,n,l,p="text",g="")=>e.jsx("input",{type:p,value:r,"data-field":l,placeholder:g,onChange:T=>n(T.target.value),className:"distribution-input"});return e.jsxs("div",{className:"quality-register-page",children:[e.jsx("style",{children:`
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
      `}),e.jsxs("div",{className:"register-topbar",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Document Control"}),e.jsx("p",{children:"Quality Management System · MS Q001 LOG 2"})]}),e.jsxs("div",{className:"register-actions",children:[x==="new"&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"register-btn primary",onClick:o,children:"+ Add Row"}),e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Register"})]}),x==="master"&&e.jsx("button",{type:"button",className:"register-btn",onClick:A,disabled:b,children:b?"Refreshing...":"↻ Refresh Records"})]})]}),e.jsxs("div",{className:"register-tabs",children:[e.jsx("button",{type:"button",className:`register-tab ${x==="new"?"active":""}`,onClick:()=>y("new"),children:"New Distribution Entry"}),e.jsxs("button",{type:"button",className:`register-tab ${x==="master"?"active":""}`,onClick:()=>y("master"),children:["Master Distribution Register (",w.length,")"]})]}),x==="new"?e.jsx("div",{className:"register-paper",children:e.jsxs("div",{className:"document-sheet",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Document Distribution Record"}),e.jsx("p",{children:"Complete the details below. Add another row when you need to distribute an additional document."})]}),e.jsxs("span",{className:"record-count",children:[a.length," ",a.length===1?"entry row":"entry rows"]})]}),e.jsxs("div",{className:"document-header",children:[e.jsx("div",{className:"logo-cell",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"document-title",children:[e.jsxs("strong",{children:["Document Control",e.jsx("br",{}),"Distribution List"]}),e.jsx("span",{children:"Quality Management System"})]}),e.jsxs("div",{className:"document-details",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Doc No.:"}),e.jsx("div",{className:"detail-value",children:"MS Q001 LOG 2"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Issue Date:"}),e.jsx("div",{className:"detail-value",children:"03/07/2023"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Version No.:"}),e.jsx("div",{className:"detail-value",children:"1"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Rev Date:"}),e.jsx("div",{className:"detail-value",children:"17/02/2025"})]})]})]}),e.jsxs("div",{className:"approval-row",children:[e.jsx("div",{className:"approval-label",children:"Compiled By:"}),e.jsx("div",{className:"approval-value",children:"Tania Naicker"}),e.jsx("div",{className:"approval-label",children:"Approved By:"}),e.jsx("div",{className:"approval-value",children:"Livinia Govender"})]}),e.jsxs("div",{className:"table-section-heading",children:[e.jsx("h3",{children:"Distribution Entries"}),e.jsx("span",{children:"Required fields: Document No. and Distributed To"})]}),e.jsx("div",{className:"table-scroll",children:e.jsxs("table",{className:"register-table",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"15%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"19%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"10%"}})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Document No."}),e.jsx("th",{children:"Version No."}),e.jsx("th",{children:"Distributed To"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Recipient Sign"}),e.jsx("th",{children:"Withdrawn On"}),e.jsx("th",{children:"Document Controller Sign"}),e.jsx("th",{className:"no-print",children:"Action"})]})}),e.jsx("tbody",{children:i.map(r=>e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsxs("div",{className:"factory-editor",children:[e.jsx("label",{children:"Factory"}),e.jsxs("select",{value:r.factory,onChange:n=>c(r.id,"factory",n.target.value),children:[e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]}),s(r.documentNo,n=>c(r.id,"documentNo",n),"documentNo","text","Document No.")]}),e.jsx("td",{children:s(r.versionNo,n=>c(r.id,"versionNo",n),"versionNo","text","Version")}),e.jsx("td",{children:s(r.distributedTo,n=>c(r.id,"distributedTo",n),"distributedTo","text","Recipient / Department")}),e.jsx("td",{children:s(r.date,n=>c(r.id,"date",n),"date","date")}),e.jsx("td",{children:s(r.recipientSign,n=>c(r.id,"recipientSign",n),"recipientSign","text","Signature")}),e.jsx("td",{children:s(r.withdrawnOn,n=>c(r.id,"withdrawnOn",n),"withdrawnOn","date")}),e.jsx("td",{children:s(r.controllerSign,n=>c(r.id,"controllerSign",n),"controllerSign","text","Signature")}),e.jsx("td",{className:"no-print",children:e.jsxs("div",{className:"row-actions",children:[e.jsx("button",{type:"button",className:"save-row-btn",disabled:j!==null,onClick:n=>D(n,r.id),children:j===r.id?"Saving...":"Save"}),e.jsx("button",{type:"button",className:"remove-row-btn",disabled:j===r.id,onClick:()=>d(r.id),children:"Remove"})]})})]},r.id))})]})}),e.jsx("div",{className:"add-row-area no-print",children:e.jsx("button",{type:"button",className:"add-row-btn",onClick:o,children:"+ Add Another Entry Row"})}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc No.: MS Q001 LOG 2"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 1"})]})]})}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Distribution Register"}),e.jsx("p",{children:"All distribution records saved in the Quality System."})]}),e.jsxs("span",{className:"record-count",children:[t.length," records"]})]}),e.jsxs("div",{className:"register-filters",style:{marginBottom:20},children:[e.jsx("input",{className:"register-search",placeholder:"Search document number or recipient...",value:k,onChange:r=>h(r.target.value)}),e.jsxs("select",{value:N,onChange:r=>E(r.target.value),children:[e.jsx("option",{value:"All",children:"All Factories"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]}),b?e.jsx("div",{className:"empty-state",children:"Loading saved distribution records..."}):t.length===0?e.jsx("div",{className:"empty-state",children:"No matching distribution entries found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document No."}),e.jsx("th",{children:"Version"}),e.jsx("th",{children:"Distributed To"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Recipient Sign"}),e.jsx("th",{children:"Withdrawn On"}),e.jsx("th",{children:"Controller Sign"})]})}),e.jsx("tbody",{children:t.map(r=>{var n,l,p,g,T,_,Q;return e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"factory-pill",children:r.factory})}),e.jsx("td",{children:((n=r.form_data)==null?void 0:n.documentNo)||"-"}),e.jsx("td",{children:((l=r.form_data)==null?void 0:l.versionNo)||"-"}),e.jsx("td",{children:((p=r.form_data)==null?void 0:p.distributedTo)||"-"}),e.jsx("td",{children:((g=r.form_data)==null?void 0:g.date)||"-"}),e.jsx("td",{children:((T=r.form_data)==null?void 0:T.recipientSign)||"-"}),e.jsx("td",{children:((_=r.form_data)==null?void 0:_.withdrawnOn)||"-"}),e.jsx("td",{children:((Q=r.form_data)==null?void 0:Q.controllerSign)||"-"})]},r.id)})})]})})]})]})}const z=a=>({id:a,factory:"",documentNumber:"",documentName:"",versionNumber:"",date:"",storage:"",retentionTime:"",protection:"",disposition:""});function J(){const[a,m]=u.useState([z(1)]),[f,S]=u.useState(2),[N,E]=u.useState([]),[w,R]=u.useState(!0),[b,C]=u.useState(null),[j,O]=u.useState("new"),[x,y]=u.useState(""),k=async()=>{R(!0);try{const{data:t,error:s}=await v.from("fms_quality_records").select("*").eq("title","Obsolete Document List").order("created_at",{ascending:!1});if(s){console.error("Error loading obsolete documents:",s),alert("Could not load obsolete documents: "+s.message);return}E(t||[])}finally{R(!1)}};u.useEffect(()=>{k()},[]);const h=(t,s,r)=>{m(n=>n.map(l=>l.id===t?{...l,[s]:r}:l))},A=async t=>{if(b===null){if(!t.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!t.documentNumber.trim()||!t.documentName.trim()){alert("Please complete the required fields: Document Number and Document Name.");return}C(t.id);try{const{data:s,error:r}=await v.auth.getUser();if(r||!s.user){alert("You must be logged in to save this entry.");return}const{error:n}=await v.from("fms_quality_records").insert({title:"Obsolete Document List",record_number:`ODL-${Date.now()}`,factory:t.factory.toLowerCase(),form_data:{factory:t.factory,documentNumber:t.documentNumber.trim(),documentName:t.documentName.trim(),versionNumber:t.versionNumber,date:t.date,storage:t.storage,retentionTime:t.retentionTime,protection:t.protection,disposition:t.disposition},status:"submitted",created_by:s.user.id,updated_by:s.user.id,submitted_at:new Date().toISOString()});if(n){console.error("Obsolete document save error:",n),alert("Could not save entry: "+n.message);return}alert("Obsolete document entry saved successfully!"),m(l=>l.map(p=>p.id===t.id?z(p.id):p)),await k()}catch(s){console.error("Unexpected save error:",s),alert("An unexpected error occurred while saving.")}finally{C(null)}}},c=()=>{m(t=>[...t,z(f)]),S(t=>t+1)},D=t=>{if(a.length===1){alert("You must keep at least one entry row.");return}m(s=>s.filter(r=>r.id!==t))},o=N.filter(t=>{const s=t.form_data||{};return[t.factory,s.factory,s.documentNumber,s.documentName,s.versionNumber,s.storage,s.disposition,t.record_number].join(" ").toLowerCase().includes(x.toLowerCase())}),d=t=>{var r;const s=t.factory||((r=t.form_data)==null?void 0:r.factory)||"";return s.toLowerCase()==="rockwood"?"Rockwood":s.toLowerCase()==="nguni"?"Nguni":"Not selected"},i=(t,s,r="text",n="")=>e.jsx("input",{type:r,value:t,placeholder:n,onChange:l=>s(l.target.value),className:"distribution-input"});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Document Control"}),e.jsx("p",{children:"Quality Management System · MS Q001 LOG 3"})]}),e.jsxs("div",{className:"register-actions",children:[j==="new"&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"register-btn primary",onClick:c,children:"+ Add Row"}),e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Register"})]}),j==="master"&&e.jsx("button",{type:"button",className:"register-btn",onClick:k,disabled:w,children:w?"Refreshing...":"↻ Refresh Records"})]})]}),e.jsxs("div",{className:"register-tabs",children:[e.jsx("button",{type:"button",className:`register-tab ${j==="new"?"active":""}`,onClick:()=>O("new"),children:"New Obsolete Document Entry"}),e.jsxs("button",{type:"button",className:`register-tab ${j==="master"?"active":""}`,onClick:()=>O("master"),children:["Master Obsolete Document Register (",N.length,")"]})]}),j==="new"?e.jsx("div",{className:"register-paper",children:e.jsxs("div",{className:"document-sheet",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Obsolete Document Record"}),e.jsx("p",{children:"Record obsolete controlled documents and their storage, retention and final disposition."})]}),e.jsxs("span",{className:"record-count",children:[a.length," ",a.length===1?"entry row":"entry rows"]})]}),e.jsxs("div",{className:"document-header",children:[e.jsx("div",{className:"logo-cell",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"document-title",children:[e.jsxs("strong",{children:["OBSOLETE",e.jsx("br",{}),"DOCUMENT LIST"]}),e.jsx("span",{children:"Quality Management System"})]}),e.jsxs("div",{className:"document-details",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Doc. No.:"}),e.jsx("div",{className:"detail-value",children:"MS Q001 LOG 3"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Issue Date:"}),e.jsx("div",{className:"detail-value",children:"03/07/2023"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Version No.:"}),e.jsx("div",{className:"detail-value",children:"3"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Revision Date:"}),e.jsx("div",{className:"detail-value",children:"06/06/2025"})]})]})]}),e.jsxs("div",{className:"table-section-heading",children:[e.jsx("h3",{children:"Obsolete Document Entries"}),e.jsx("span",{children:"Required fields: Factory, Document Number and Document Name"})]}),e.jsx("div",{className:"table-scroll",children:e.jsxs("table",{className:"register-table",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"15%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"9%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"11%"}}),e.jsx("col",{style:{width:"5%"}})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document Number"}),e.jsx("th",{children:"Document Name"}),e.jsx("th",{children:"Version Number"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Storage"}),e.jsx("th",{children:"Retention Time"}),e.jsx("th",{children:"Protection"}),e.jsx("th",{children:"Disposition of Document"}),e.jsx("th",{className:"no-print",children:"Action"})]})}),e.jsx("tbody",{children:a.map(t=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsxs("select",{value:t.factory,onChange:s=>h(t.id,"factory",s.target.value),className:"distribution-input",required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})}),e.jsx("td",{children:i(t.documentNumber,s=>h(t.id,"documentNumber",s),"text","Document No.")}),e.jsx("td",{children:i(t.documentName,s=>h(t.id,"documentName",s),"text","Document Name")}),e.jsx("td",{children:i(t.versionNumber,s=>h(t.id,"versionNumber",s),"text","Version")}),e.jsx("td",{children:i(t.date,s=>h(t.id,"date",s),"date")}),e.jsx("td",{children:i(t.storage,s=>h(t.id,"storage",s),"text","Storage")}),e.jsx("td",{children:i(t.retentionTime,s=>h(t.id,"retentionTime",s),"text","Retention")}),e.jsx("td",{children:i(t.protection,s=>h(t.id,"protection",s),"text","Protection")}),e.jsx("td",{children:i(t.disposition,s=>h(t.id,"disposition",s),"text","Disposition")}),e.jsx("td",{className:"no-print",children:e.jsxs("div",{className:"row-actions",children:[e.jsx("button",{type:"button",className:"save-row-btn",disabled:b!==null,onClick:()=>A(t),children:b===t.id?"Saving...":"Save"}),e.jsx("button",{type:"button",className:"remove-row-btn",disabled:b===t.id,onClick:()=>D(t.id),children:"Remove"})]})})]},t.id))})]})}),e.jsx("div",{className:"add-row-area no-print",children:e.jsx("button",{type:"button",className:"add-row-btn",onClick:c,children:"+ Add Another Entry Row"})}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc. No.: MS Q001 LOG 3"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 3"})]})]})}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Obsolete Document Register"}),e.jsx("p",{children:"All obsolete document records saved in the Quality System."})]}),e.jsxs("span",{className:"record-count",children:[o.length," records"]})]}),e.jsx("div",{className:"register-filters",style:{marginBottom:20},children:e.jsx("input",{className:"register-search",placeholder:"Search factory, document number or name...",value:x,onChange:t=>y(t.target.value)})}),w?e.jsx("div",{className:"empty-state",children:"Loading saved obsolete document records..."}):o.length===0?e.jsx("div",{className:"empty-state",children:"No matching obsolete document entries found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document Number"}),e.jsx("th",{children:"Document Name"}),e.jsx("th",{children:"Version Number"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Storage"}),e.jsx("th",{children:"Retention Time"}),e.jsx("th",{children:"Protection"}),e.jsx("th",{children:"Disposition"})]})}),e.jsx("tbody",{children:o.map(t=>{const s=t.form_data||{};return e.jsxs("tr",{children:[e.jsx("td",{children:d(t)}),e.jsx("td",{children:s.documentNumber||"-"}),e.jsx("td",{children:s.documentName||"-"}),e.jsx("td",{children:s.versionNumber||"-"}),e.jsx("td",{children:s.date||"-"}),e.jsx("td",{children:s.storage||"-"}),e.jsx("td",{children:s.retentionTime||"-"}),e.jsx("td",{children:s.protection||"-"}),e.jsx("td",{children:s.disposition||"-"})]},t.id)})})]})})]})]})}const B=()=>{const a=new Date;return`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,"0")}-${String(a.getDate()).padStart(2,"0")}`},$=()=>({factory:"",originatorName:"",productDescription:"",contractorSupplier:"",batchNumber:"",quantity:"",ncrNumber:"",foundDuring:[],otherActivity:"",problemDescription:"",immediateAction:"",dateOfOccurrence:"",reportingSignature:"",reportingDate:"",criticality:"",retestingResult:"",disposition:"",otherDisposition:"",requiredAction:"",owner:"",dateAssigned:B(),investigationDueDate:"",correctiveActionCompleted:"",productionManagerName:"",productionManagerDate:"",productionManagerSignature:"",correctiveActionApproval:"",capaRcaNumber:"",ownerName:"",ownerDate:"",ownerSignature:"",qualityDesignee:"",plannedDispositionCompleted:"",newNCRNumber:"",qualitySignature:"",qualityDate:""});function Z(){const[a,m]=u.useState($()),[f,S]=u.useState("new"),[N,E]=u.useState([]),[w,R]=u.useState(!1),[b,C]=u.useState(!1),[j,O]=u.useState(""),x=(i,t)=>{m(s=>{const r={...s,[i]:t};if(i==="criticality"||i==="dateAssigned"){const n=r.criticality==="High"?10:r.criticality==="Medium/Moderate"?15:r.criticality==="Low"?20:0;if(n&&r.dateAssigned){const l=new Date(`${r.dateAssigned}T00:00:00`);l.setDate(l.getDate()+n),r.investigationDueDate=`${l.getFullYear()}-${String(l.getMonth()+1).padStart(2,"0")}-${String(l.getDate()).padStart(2,"0")}`}else r.investigationDueDate=""}return r})},y=async()=>{R(!0);try{const{data:i,error:t}=await v.from("fms_quality_records").select("*").eq("title","Non-Conformance Report").order("created_at",{ascending:!1});if(t)throw t;E(i||[])}catch(i){alert("Could not load NCR records: "+i.message)}finally{R(!1)}};u.useEffect(()=>{y()},[]);const k=async i=>{const t=new Date().getFullYear(),s=i==="Rockwood"?"R":"N",{data:r,error:n}=await v.from("fms_quality_records").select("record_number, form_data").eq("title","Non-Conformance Report").eq("factory",i.toLowerCase());if(n)throw n;const l=(r||[]).map(g=>{var Q;const T=((Q=g.form_data)==null?void 0:Q.ncrNumber)||g.record_number||"",_=String(T).match(new RegExp(`NCR\\s+(\\d+)/${t}/${s}`));return _?Number(_[1]):0}),p=Math.max(0,...l)+1;return`NCR ${String(p).padStart(2,"0")}/${t}/${s}`},h=async()=>{if(!b){if(!a.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!a.originatorName.trim()||!a.productDescription.trim()||!a.batchNumber.trim()||!a.problemDescription.trim()){alert("Please complete the Factory, Originator Name, Product Description, Batch Number and Problem Description.");return}C(!0);try{const{data:i,error:t}=await v.auth.getUser();if(t||!i.user){alert("You must be logged in to save this NCR.");return}const s=await k(a.factory),r={...a,ncrNumber:s},{error:n}=await v.from("fms_quality_records").insert({title:"Non-Conformance Report",record_number:s,factory:a.factory.toLowerCase(),form_data:{...r,factory:a.factory},status:"submitted",created_by:i.user.id,updated_by:i.user.id,submitted_at:new Date().toISOString()});if(n)throw n;alert(`Non-Conformance Report saved successfully.
NCR Number: ${s}`),m($()),await y(),S("master")}catch(i){console.error("NCR save error:",i),alert("Could not save NCR: "+i.message)}finally{C(!1)}}},A=i=>{const t=a.foundDuring.includes(i);x("foundDuring",t?a.foundDuring.filter(s=>s!==i):[...a.foundDuring,i])},c=(i,t,s="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:i}),e.jsx("input",{type:s,value:String(a[t]||""),onChange:r=>x(t,r.target.value)})]}),D=(i,t)=>e.jsxs("label",{className:"ncr-field ncr-full",children:[e.jsx("span",{children:i}),e.jsx("textarea",{value:String(a[t]||""),onChange:s=>x(t,s.target.value),rows:4})]}),o=(i,t,s)=>e.jsxs("div",{className:"ncr-choice-group",children:[e.jsx("strong",{children:i}),e.jsx("div",{className:"ncr-options",children:s.map(r=>e.jsxs("label",{children:[e.jsx("input",{type:"radio",name:String(t),checked:a[t]===r,onChange:()=>x(t,r)}),r]},r))})]}),d=N.filter(i=>{const t=i.form_data||{};return[i.record_number,i.factory,t.factory,t.originatorName,t.productDescription,t.batchNumber,i.status].join(" ").toLowerCase().includes(j.toLowerCase())});return e.jsxs("div",{className:"quality-register-page ncr-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Non-Conformance Report"}),e.jsx("p",{children:"Quality Management System · MS Q002 FORM 1"})]}),e.jsx("div",{className:"register-actions",children:f==="new"?e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Form"}):e.jsx("button",{type:"button",className:"register-btn",onClick:y,disabled:w,children:"Refresh Records"})})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${f==="new"?"active":""}`,onClick:()=>S("new"),children:"New NCR"}),e.jsxs("button",{type:"button",className:`register-tab ${f==="master"?"active":""}`,onClick:()=>S("master"),children:["Master NCR Register (",N.length,")"]})]}),f==="new"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("div",{className:"ncr-logo",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"ncr-title",children:["Non-Conformance",e.jsx("br",{}),"Report Form"]}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsxs("div",{children:[e.jsx("span",{children:"Doc No.:"}),e.jsx("strong",{children:"MS Q002 FORM 1"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Issue Date:"}),e.jsx("strong",{children:"03/07/2023"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Version No.:"}),e.jsx("strong",{children:"1"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Rev Date:"}),e.jsx("strong",{children:"14/01/2025"})]})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By:"}),e.jsx("input",{value:" ",readOnly:!0}),e.jsx("span",{children:"Approved By:"}),e.jsx("input",{value:" ",readOnly:!0})]})]}),e.jsx("div",{className:"ncr-factory no-print",children:e.jsxs("label",{children:["Factory *",e.jsxs("select",{value:a.factory,onChange:i=>x("factory",i.target.value),required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]})}),e.jsxs("div",{className:"ncr-factory print-only",children:["Factory: ",a.factory||"Not selected"]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 1: (To be completed by Reporting Party)"}),e.jsxs("div",{className:"ncr-grid",children:[c("Originator Name:","originatorName"),c("Product Description:","productDescription"),c("Contractor/Supplier:","contractorSupplier"),c("Batch Number:","batchNumber"),c("Qty:","quantity"),c("NCR Number:","ncrNumber")]}),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"FOUND DURING WHAT ACTIVITY:"}),e.jsx("div",{className:"ncr-options ncr-activity",children:["Incoming Inspection","Final Inspection","In-process Inspection","Other"].map(i=>e.jsxs("label",{children:[e.jsx("input",{type:"checkbox",checked:a.foundDuring.includes(i),onChange:()=>A(i)}),i]},i))}),a.foundDuring.includes("Other")&&c("Other activity:","otherActivity")]}),D("PROBLEM DESCRIPTION (attach any supporting documents):","problemDescription"),D("IMMEDIATE ACTION TAKEN:","immediateAction"),e.jsxs("div",{className:"ncr-grid ncr-bottom-fields",children:[c("Date of Occurrence:","dateOfOccurrence","date"),c("Reporting Party Signature:","reportingSignature"),c("Date:","reportingDate","date")]})]}),e.jsxs("div",{className:"ncr-sheet ncr-second-page",children:[e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 2: (To be completed by Production Manager)"}),o("CRITICALITY LEVEL:","criticality",["High","Medium/Moderate","Low"]),D("RETESTING OF PRODUCT RESULT:","retestingResult"),o("DISPOSITION:","disposition",["Use-as-is","Rework","Return to supplier","Repair","Reject","Other"]),a.disposition==="Other"&&c("Other disposition:","otherDisposition"),D("REQUIRED ACTION:","requiredAction"),e.jsxs("div",{className:"ncr-grid",children:[c("Owner:","owner"),c("Date Assigned:","dateAssigned","date"),c("Investigation due date:","investigationDueDate","date")]}),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"Planned Disposition has been completed and Corrective action has been initiated (Attach proof of completion where possible)"}),o("","correctiveActionCompleted",["Yes","No"]),c("New NCR No. if no:","newNCRNumber"),e.jsxs("div",{className:"ncr-grid",children:[c("Name:","productionManagerName"),c("Date:","productionManagerDate","date"),c("Signature:","productionManagerSignature")]})]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 3: (To be completed by Owner & return to Production Manager for review prior to due date)"}),o("Approval of Corrective/Preventative Action:","correctiveActionApproval",["Yes","No"]),c("CAPA & RCA Form No. Issued:","capaRcaNumber"),e.jsxs("div",{className:"ncr-grid",children:[c("Name:","ownerName"),c("Date:","ownerDate","date"),c("Signature:","ownerSignature")]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 4: (To be completed by Quality Designee or Other (Specify) completes:"}),c("Quality Designee / Other:","qualityDesignee"),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"CLOSING THE NON-CONFORMANCE"}),e.jsx("p",{children:"Planned Disposition has been completed and Corrective action has been initiated:"}),e.jsx("p",{children:"(Attach proof of completion where possible)"}),o("","plannedDispositionCompleted",["Yes","No"]),c("If No, new NCR No.:","newNCRNumber"),e.jsxs("div",{className:"ncr-grid",children:[c("Quality Designee Signature:","qualitySignature"),c("Date:","qualityDate","date")]})]})]}),e.jsx("div",{className:"no-print ncr-save-area",children:e.jsx("button",{type:"button",className:"register-btn primary",onClick:h,disabled:b,children:b?"Saving NCR...":"Save Non-Conformance Report"})})]}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Non-Conformance Register"}),e.jsx("p",{children:"Saved Non-Conformance Reports for Rockwood and Nguni."})]}),e.jsxs("span",{className:"record-count",children:[d.length," records"]})]}),e.jsx("input",{className:"register-search",placeholder:"Search factory, NCR number, product or batch...",value:j,onChange:i=>O(i.target.value)}),w?e.jsx("div",{className:"empty-state",children:"Loading NCR records..."}):d.length===0?e.jsx("div",{className:"empty-state",children:"No NCR records found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"NCR Number"}),e.jsx("th",{children:"Product"}),e.jsx("th",{children:"Batch Number"}),e.jsx("th",{children:"Criticality"}),e.jsx("th",{children:"Investigation Due"}),e.jsx("th",{children:"Status"}),e.jsx("th",{children:"Date Created"})]})}),e.jsx("tbody",{children:d.map(i=>{const t=i.form_data||{},s=String(i.factory||t.factory||"");return e.jsxs("tr",{children:[e.jsx("td",{children:s.toLowerCase()==="rockwood"?"Rockwood":s.toLowerCase()==="nguni"?"Nguni":"-"}),e.jsx("td",{children:i.record_number}),e.jsx("td",{children:t.productDescription||"-"}),e.jsx("td",{children:t.batchNumber||"-"}),e.jsx("td",{children:t.criticality||"-"}),e.jsx("td",{children:t.investigationDueDate||"-"}),e.jsx("td",{children:i.status||"-"}),e.jsx("td",{children:i.created_at?new Date(i.created_at).toLocaleDateString():"-"})]},i.id)})})]})})]})]})}const V=()=>({factory:"",dateQuarantined:B(),tagNumber:"",supplierName:"",batchNumber:"",productDescription:"",reasonForQuarantine:"",customerName:"",quantityInQuarantine:"",quarantineType:"",ncrNumber:"",quarantineName:"",quarantineSignature:"",deliveryNoteNumber:"",releaseDecision:"",releaseSignature:"",releaseDate:""});function ee(){const[a,m]=u.useState(V()),[f,S]=u.useState("new"),[N,E]=u.useState([]),[w,R]=u.useState(!1),[b,C]=u.useState(!1),[j,O]=u.useState(""),x=(o,d)=>{m(i=>({...i,[o]:d}))},y=async()=>{R(!0);try{const{data:o,error:d}=await v.from("fms_quality_records").select("*").eq("title","Quarantine Tag").order("created_at",{ascending:!1});if(d)throw d;E(o||[])}catch(o){alert("Could not load quarantine records: "+o.message)}finally{R(!1)}};u.useEffect(()=>{y()},[]);const k=async()=>{if(!b){if(!a.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!a.tagNumber.trim()||!a.productDescription.trim()||!a.reasonForQuarantine.trim()){alert("Please complete the Tag Number, Product Description and Reason for Quarantine.");return}C(!0);try{const{data:o,error:d}=await v.auth.getUser();if(d||!o.user){alert("You must be logged in to save this quarantine tag.");return}const i={...a},{error:t}=await v.from("fms_quality_records").insert({title:"Quarantine Tag",record_number:a.tagNumber.trim(),factory:a.factory.toLowerCase(),form_data:{...i,factory:a.factory},status:a.releaseDecision?"released":"quarantined",created_by:o.user.id,updated_by:o.user.id,submitted_at:new Date().toISOString()});if(t)throw t;alert("Quarantine Tag saved successfully!"),m(V()),await y(),S("master")}catch(o){console.error("Quarantine Tag save error:",o),alert("Could not save Quarantine Tag: "+o.message)}finally{C(!1)}}},h=(o,d,i="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:o}),e.jsx("input",{type:i,value:a[d],onChange:t=>x(d,t.target.value)})]}),A=(o,d)=>e.jsxs("label",{className:"ncr-field ncr-full",children:[e.jsx("span",{children:o}),e.jsx("textarea",{rows:3,value:a[d],onChange:i=>x(d,i.target.value)})]}),c=(o,d,i)=>e.jsxs("div",{className:"ncr-choice-group",children:[e.jsx("strong",{children:o}),e.jsx("div",{className:"ncr-options",children:i.map(t=>e.jsxs("label",{children:[e.jsx("input",{type:"radio",name:d,checked:a[d]===t,onChange:()=>x(d,t)}),t]},t))})]}),D=N.filter(o=>{const d=o.form_data||{};return[o.record_number,o.factory,d.tagNumber,d.batchNumber,d.productDescription,d.supplierName,d.customerName,d.releaseDecision].join(" ").toLowerCase().includes(j.toLowerCase())});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Quarantine Tag"}),e.jsx("p",{children:"Quality Management System · MS Q002 FORM 2"})]}),e.jsx("div",{className:"register-actions",children:f==="new"?e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Tag"}):e.jsx("button",{type:"button",className:"register-btn",onClick:y,disabled:w,children:"Refresh Records"})})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${f==="new"?"active":""}`,onClick:()=>S("new"),children:"New Quarantine Tag"}),e.jsxs("button",{type:"button",className:`register-tab ${f==="master"?"active":""}`,onClick:()=>S("master"),children:["Master Quarantine Register (",N.length,")"]})]}),f==="new"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("div",{className:"ncr-logo",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsx("div",{className:"ncr-title",children:"QUARANTINE TAG"}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsxs("div",{children:[e.jsx("span",{children:"Doc No.:"}),e.jsx("strong",{children:"MS Q002 FORM 2"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Issue Date:"}),e.jsx("strong",{children:"12/06/2019"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Version No.:"}),e.jsx("strong",{children:"2"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Rev Date:"}),e.jsx("strong",{children:"14/01/2025"})]})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By:"}),e.jsx("strong",{children:"Tania Naicker"}),e.jsx("span",{children:"Approved By:"}),e.jsx("strong",{children:"Livinia Govender"})]})]}),e.jsx("div",{className:"ncr-factory no-print",children:e.jsxs("label",{children:["Factory *",e.jsxs("select",{value:a.factory,onChange:o=>x("factory",o.target.value),required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]})}),e.jsxs("div",{className:"ncr-factory print-only",children:["Factory: ",a.factory||"Not selected"]}),e.jsxs("div",{className:"ncr-grid",children:[h("Date Quarantined:","dateQuarantined","date"),h("Tag No.:","tagNumber"),h("Name of Supplier:","supplierName"),h("Batch Number:","batchNumber"),h("Product Description:","productDescription"),h("Name of Customer:","customerName"),h("Quantity in Quarantine:","quantityInQuarantine")]}),A("Reason for Quarantine:","reasonForQuarantine"),c("Quarantine Type:","quarantineType",["Rework","Scrap"]),e.jsxs("div",{className:"ncr-grid",children:[h("NCR No.:","ncrNumber"),h("Name:","quarantineName"),h("Delivery Note No.:","deliveryNoteNumber"),h("Signature:","quarantineSignature")]}),e.jsx("h3",{className:"ncr-section-heading",children:"RELEASE"}),c("Release Decision:","releaseDecision",["Return to Supplier","Accept on concession","Return to stock","Sell on concession"]),e.jsxs("div",{className:"ncr-grid",children:[h("Release Signature:","releaseSignature"),h("Release Date:","releaseDate","date")]}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc No.: MS Q002 FORM 2"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 2"})]})]}),e.jsx("div",{className:"no-print ncr-save-area",children:e.jsx("button",{type:"button",className:"register-btn primary",onClick:k,disabled:b,children:b?"Saving...":"Save Quarantine Tag"})})]}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Quarantine Register"}),e.jsx("p",{children:"Quarantine records for Rockwood and Nguni."})]}),e.jsxs("span",{className:"record-count",children:[D.length," records"]})]}),e.jsx("input",{className:"register-search",placeholder:"Search tag, factory, product, batch or supplier...",value:j,onChange:o=>O(o.target.value)}),w?e.jsx("div",{className:"empty-state",children:"Loading quarantine records..."}):D.length===0?e.jsx("div",{className:"empty-state",children:"No quarantine records found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Tag No."}),e.jsx("th",{children:"Date Quarantined"}),e.jsx("th",{children:"Product"}),e.jsx("th",{children:"Batch Number"}),e.jsx("th",{children:"Supplier"}),e.jsx("th",{children:"Quantity"}),e.jsx("th",{children:"Quarantine Type"}),e.jsx("th",{children:"Release Decision"}),e.jsx("th",{children:"Status"})]})}),e.jsx("tbody",{children:D.map(o=>{const d=o.form_data||{},i=String(o.factory||d.factory||"");return e.jsxs("tr",{children:[e.jsx("td",{children:i.toLowerCase()==="rockwood"?"Rockwood":i.toLowerCase()==="nguni"?"Nguni":"-"}),e.jsx("td",{children:o.record_number||"-"}),e.jsx("td",{children:d.dateQuarantined||"-"}),e.jsx("td",{children:d.productDescription||"-"}),e.jsx("td",{children:d.batchNumber||"-"}),e.jsx("td",{children:d.supplierName||"-"}),e.jsx("td",{children:d.quantityInQuarantine||"-"}),e.jsx("td",{children:d.quarantineType||"-"}),e.jsx("td",{children:d.releaseDecision||"-"}),e.jsx("td",{children:o.status||"-"})]},o.id)})})]})})]})]})}function re(){const a=W(),m=new URLSearchParams(a.search).get("category");return e.jsxs("div",{className:"quality-register-page",children:[m==="Document Control Distribution"&&e.jsx(K,{}),m==="Obsolete Document List"&&e.jsx(J,{}),m==="Non-Conformance Report"&&e.jsx(Z,{}),m==="Quarantine Tag"&&e.jsx(ee,{}),!m&&e.jsx("div",{className:"register-paper",children:"Select a form from the Forms section in the sidebar."}),m&&!["Document Control Distribution","Obsolete Document List","Non-Conformance Report","Quarantine Tag"].includes(m)&&e.jsx("div",{className:"register-paper",children:"Form not found."})]})}export{re as default};
