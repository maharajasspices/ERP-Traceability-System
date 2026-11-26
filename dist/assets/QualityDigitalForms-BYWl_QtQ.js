import{r as d,j as e,s as v,aS as J}from"./index-oBiVMrxp.js";const P=i=>({id:i,factory:"Rockwood",documentNo:"",versionNo:"",distributedTo:"",date:"",recipientSign:"",withdrawnOn:"",controllerSign:""});function Z(){const[i,h]=d.useState([P(1)]),[f,w]=d.useState(2),[g,T]=d.useState("All"),[N,R]=d.useState([]),[x,C]=d.useState(!0),[j,O]=d.useState(null),[p,y]=d.useState("new"),[k,m]=d.useState(""),E=async()=>{C(!0);try{const{data:s,error:n}=await v.from("fms_quality_records").select("*").eq("title","Document Control Distribution List").order("created_at",{ascending:!1});if(n){console.error("Error loading distribution entries:",n),alert("Could not load saved distribution entries: "+n.message);return}R(s||[])}finally{C(!1)}};d.useEffect(()=>{E()},[]);const l=(s,n,u)=>{h(b=>b.map(S=>S.id===s?{...S,[n]:u}:S))},D=async(s,n)=>{if(j!==null)return;const u=s.currentTarget.closest("tr");if(!u){alert("Could not find the distribution row.");return}const b=I=>{var L,q;return((q=(L=u.querySelector(`input[data-field="${I}"]`))==null?void 0:L.value)==null?void 0:q.trim())||""},S=b("documentNo"),_=b("distributedTo"),A=b("versionNo"),Q=b("date"),Y=b("recipientSign"),H=b("withdrawnOn"),X=b("controllerSign"),M=u.querySelector(".factory-editor select"),W=(M==null?void 0:M.value)==="Nguni"?"Nguni":"Rockwood";if(!S||!_){alert(`Please complete the required fields.

Document No.: ${S||"EMPTY"}
Distributed To: ${_||"EMPTY"}`);return}O(n);try{const{data:I,error:L}=await v.auth.getUser();if(L||!I.user){alert("You must be logged in to save this entry.");return}const{error:q}=await v.from("fms_quality_records").insert({title:"Document Control Distribution List",record_number:`DCD-${Date.now()}`,factory:W.toLowerCase(),form_data:{documentNo:S,versionNo:A,distributedTo:_,date:Q,recipientSign:Y,withdrawnOn:H,controllerSign:X},status:"submitted",created_by:I.user.id,updated_by:I.user.id,submitted_at:new Date().toISOString()});if(q){console.error("SUPABASE SAVE ERROR:",q),alert("Could not save entry: "+q.message);return}alert("Distribution entry saved successfully!"),h(K=>K.map(F=>F.id===n?P(F.id):F)),await E()}catch(I){console.error("Unexpected save error:",I),alert("An unexpected error occurred while saving.")}finally{O(null)}},o=()=>{h(s=>[...s,P(f)]),w(s=>s+1)},c=s=>{if(i.length===1){alert("You must keep at least one entry row.");return}h(n=>n.filter(u=>u.id!==s))},r=i.filter(s=>g==="All"||s.factory===g),t=N.filter(s=>{var S;const n=g==="All"||((S=s.factory)==null?void 0:S.toLowerCase())===g.toLowerCase(),u=s.form_data||{},b=[u.documentNo,u.distributedTo,u.versionNo,s.record_number,s.factory].join(" ").toLowerCase();return n&&b.includes(k.toLowerCase())}),a=(s,n,u,b="text",S="")=>e.jsx("input",{type:b,value:s,"data-field":u,placeholder:S,onChange:_=>n(_.target.value),className:"distribution-input"});return e.jsxs("div",{className:"quality-register-page",children:[e.jsx("style",{children:`
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
      `}),e.jsxs("div",{className:"register-topbar",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Document Control"}),e.jsx("p",{children:"Quality Management System · MS Q001 LOG 2"})]}),e.jsxs("div",{className:"register-actions",children:[p==="new"&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"register-btn primary",onClick:o,children:"+ Add Row"}),e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Register"})]}),p==="master"&&e.jsx("button",{type:"button",className:"register-btn",onClick:E,disabled:x,children:x?"Refreshing...":"↻ Refresh Records"})]})]}),e.jsxs("div",{className:"register-tabs",children:[e.jsx("button",{type:"button",className:`register-tab ${p==="new"?"active":""}`,onClick:()=>y("new"),children:"New Distribution Entry"}),e.jsxs("button",{type:"button",className:`register-tab ${p==="master"?"active":""}`,onClick:()=>y("master"),children:["Master Distribution Register (",N.length,")"]})]}),p==="new"?e.jsx("div",{className:"register-paper",children:e.jsxs("div",{className:"document-sheet",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Document Distribution Record"}),e.jsx("p",{children:"Complete the details below. Add another row when you need to distribute an additional document."})]}),e.jsxs("span",{className:"record-count",children:[i.length," ",i.length===1?"entry row":"entry rows"]})]}),e.jsxs("div",{className:"document-header",children:[e.jsx("div",{className:"logo-cell",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"document-title",children:[e.jsxs("strong",{children:["Document Control",e.jsx("br",{}),"Distribution List"]}),e.jsx("span",{children:"Quality Management System"})]}),e.jsxs("div",{className:"document-details",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Doc No.:"}),e.jsx("div",{className:"detail-value",children:"MS Q001 LOG 2"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Issue Date:"}),e.jsx("div",{className:"detail-value",children:"03/07/2023"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Version No.:"}),e.jsx("div",{className:"detail-value",children:"1"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Rev Date:"}),e.jsx("div",{className:"detail-value",children:"17/02/2025"})]})]})]}),e.jsxs("div",{className:"approval-row",children:[e.jsx("div",{className:"approval-label",children:"Compiled By:"}),e.jsx("div",{className:"approval-value",children:"Tania Naicker"}),e.jsx("div",{className:"approval-label",children:"Approved By:"}),e.jsx("div",{className:"approval-value",children:"Livinia Govender"})]}),e.jsxs("div",{className:"table-section-heading",children:[e.jsx("h3",{children:"Distribution Entries"}),e.jsx("span",{children:"Required fields: Document No. and Distributed To"})]}),e.jsx("div",{className:"table-scroll",children:e.jsxs("table",{className:"register-table",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"15%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"19%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"10%"}})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Document No."}),e.jsx("th",{children:"Version No."}),e.jsx("th",{children:"Distributed To"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Recipient Sign"}),e.jsx("th",{children:"Withdrawn On"}),e.jsx("th",{children:"Document Controller Sign"}),e.jsx("th",{className:"no-print",children:"Action"})]})}),e.jsx("tbody",{children:r.map(s=>e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsxs("div",{className:"factory-editor",children:[e.jsx("label",{children:"Factory"}),e.jsxs("select",{value:s.factory,onChange:n=>l(s.id,"factory",n.target.value),children:[e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]}),a(s.documentNo,n=>l(s.id,"documentNo",n),"documentNo","text","Document No.")]}),e.jsx("td",{children:a(s.versionNo,n=>l(s.id,"versionNo",n),"versionNo","text","Version")}),e.jsx("td",{children:a(s.distributedTo,n=>l(s.id,"distributedTo",n),"distributedTo","text","Recipient / Department")}),e.jsx("td",{children:a(s.date,n=>l(s.id,"date",n),"date","date")}),e.jsx("td",{children:a(s.recipientSign,n=>l(s.id,"recipientSign",n),"recipientSign","text","Signature")}),e.jsx("td",{children:a(s.withdrawnOn,n=>l(s.id,"withdrawnOn",n),"withdrawnOn","date")}),e.jsx("td",{children:a(s.controllerSign,n=>l(s.id,"controllerSign",n),"controllerSign","text","Signature")}),e.jsx("td",{className:"no-print",children:e.jsxs("div",{className:"row-actions",children:[e.jsx("button",{type:"button",className:"save-row-btn",disabled:j!==null,onClick:n=>D(n,s.id),children:j===s.id?"Saving...":"Save"}),e.jsx("button",{type:"button",className:"remove-row-btn",disabled:j===s.id,onClick:()=>c(s.id),children:"Remove"})]})})]},s.id))})]})}),e.jsx("div",{className:"add-row-area no-print",children:e.jsx("button",{type:"button",className:"add-row-btn",onClick:o,children:"+ Add Another Entry Row"})}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc No.: MS Q001 LOG 2"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 1"})]})]})}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Distribution Register"}),e.jsx("p",{children:"All distribution records saved in the Quality System."})]}),e.jsxs("span",{className:"record-count",children:[t.length," records"]})]}),e.jsxs("div",{className:"register-filters",style:{marginBottom:20},children:[e.jsx("input",{className:"register-search",placeholder:"Search document number or recipient...",value:k,onChange:s=>m(s.target.value)}),e.jsxs("select",{value:g,onChange:s=>T(s.target.value),children:[e.jsx("option",{value:"All",children:"All Factories"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]}),x?e.jsx("div",{className:"empty-state",children:"Loading saved distribution records..."}):t.length===0?e.jsx("div",{className:"empty-state",children:"No matching distribution entries found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document No."}),e.jsx("th",{children:"Version"}),e.jsx("th",{children:"Distributed To"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Recipient Sign"}),e.jsx("th",{children:"Withdrawn On"}),e.jsx("th",{children:"Controller Sign"})]})}),e.jsx("tbody",{children:t.map(s=>{var n,u,b,S,_,A,Q;return e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"factory-pill",children:s.factory})}),e.jsx("td",{children:((n=s.form_data)==null?void 0:n.documentNo)||"-"}),e.jsx("td",{children:((u=s.form_data)==null?void 0:u.versionNo)||"-"}),e.jsx("td",{children:((b=s.form_data)==null?void 0:b.distributedTo)||"-"}),e.jsx("td",{children:((S=s.form_data)==null?void 0:S.date)||"-"}),e.jsx("td",{children:((_=s.form_data)==null?void 0:_.recipientSign)||"-"}),e.jsx("td",{children:((A=s.form_data)==null?void 0:A.withdrawnOn)||"-"}),e.jsx("td",{children:((Q=s.form_data)==null?void 0:Q.controllerSign)||"-"})]},s.id)})})]})})]})]})}const $=i=>({id:i,factory:"",documentNumber:"",documentName:"",versionNumber:"",date:"",storage:"",retentionTime:"",protection:"",disposition:""});function ee(){const[i,h]=d.useState([$(1)]),[f,w]=d.useState(2),[g,T]=d.useState([]),[N,R]=d.useState(!0),[x,C]=d.useState(null),[j,O]=d.useState("new"),[p,y]=d.useState(""),k=async()=>{R(!0);try{const{data:t,error:a}=await v.from("fms_quality_records").select("*").eq("title","Obsolete Document List").order("created_at",{ascending:!1});if(a){console.error("Error loading obsolete documents:",a),alert("Could not load obsolete documents: "+a.message);return}T(t||[])}finally{R(!1)}};d.useEffect(()=>{k()},[]);const m=(t,a,s)=>{h(n=>n.map(u=>u.id===t?{...u,[a]:s}:u))},E=async t=>{if(x===null){if(!t.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!t.documentNumber.trim()||!t.documentName.trim()){alert("Please complete the required fields: Document Number and Document Name.");return}C(t.id);try{const{data:a,error:s}=await v.auth.getUser();if(s||!a.user){alert("You must be logged in to save this entry.");return}const{error:n}=await v.from("fms_quality_records").insert({title:"Obsolete Document List",record_number:`ODL-${Date.now()}`,factory:t.factory.toLowerCase(),form_data:{factory:t.factory,documentNumber:t.documentNumber.trim(),documentName:t.documentName.trim(),versionNumber:t.versionNumber,date:t.date,storage:t.storage,retentionTime:t.retentionTime,protection:t.protection,disposition:t.disposition},status:"submitted",created_by:a.user.id,updated_by:a.user.id,submitted_at:new Date().toISOString()});if(n){console.error("Obsolete document save error:",n),alert("Could not save entry: "+n.message);return}alert("Obsolete document entry saved successfully!"),h(u=>u.map(b=>b.id===t.id?$(b.id):b)),await k()}catch(a){console.error("Unexpected save error:",a),alert("An unexpected error occurred while saving.")}finally{C(null)}}},l=()=>{h(t=>[...t,$(f)]),w(t=>t+1)},D=t=>{if(i.length===1){alert("You must keep at least one entry row.");return}h(a=>a.filter(s=>s.id!==t))},o=g.filter(t=>{const a=t.form_data||{};return[t.factory,a.factory,a.documentNumber,a.documentName,a.versionNumber,a.storage,a.disposition,t.record_number].join(" ").toLowerCase().includes(p.toLowerCase())}),c=t=>{var s;const a=t.factory||((s=t.form_data)==null?void 0:s.factory)||"";return a.toLowerCase()==="rockwood"?"Rockwood":a.toLowerCase()==="nguni"?"Nguni":"Not selected"},r=(t,a,s="text",n="")=>e.jsx("input",{type:s,value:t,placeholder:n,onChange:u=>a(u.target.value),className:"distribution-input"});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Document Control"}),e.jsx("p",{children:"Quality Management System · MS Q001 LOG 3"})]}),e.jsxs("div",{className:"register-actions",children:[j==="new"&&e.jsxs(e.Fragment,{children:[e.jsx("button",{type:"button",className:"register-btn primary",onClick:l,children:"+ Add Row"}),e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Register"})]}),j==="master"&&e.jsx("button",{type:"button",className:"register-btn",onClick:k,disabled:N,children:N?"Refreshing...":"↻ Refresh Records"})]})]}),e.jsxs("div",{className:"register-tabs",children:[e.jsx("button",{type:"button",className:`register-tab ${j==="new"?"active":""}`,onClick:()=>O("new"),children:"New Obsolete Document Entry"}),e.jsxs("button",{type:"button",className:`register-tab ${j==="master"?"active":""}`,onClick:()=>O("master"),children:["Master Obsolete Document Register (",g.length,")"]})]}),j==="new"?e.jsx("div",{className:"register-paper",children:e.jsxs("div",{className:"document-sheet",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Obsolete Document Record"}),e.jsx("p",{children:"Record obsolete controlled documents and their storage, retention and final disposition."})]}),e.jsxs("span",{className:"record-count",children:[i.length," ",i.length===1?"entry row":"entry rows"]})]}),e.jsxs("div",{className:"document-header",children:[e.jsx("div",{className:"logo-cell",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"document-title",children:[e.jsxs("strong",{children:["OBSOLETE",e.jsx("br",{}),"DOCUMENT LIST"]}),e.jsx("span",{children:"Quality Management System"})]}),e.jsxs("div",{className:"document-details",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Doc. No.:"}),e.jsx("div",{className:"detail-value",children:"MS Q001 LOG 3"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Issue Date:"}),e.jsx("div",{className:"detail-value",children:"03/07/2023"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Version No.:"}),e.jsx("div",{className:"detail-value",children:"3"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("div",{className:"detail-label",children:"Revision Date:"}),e.jsx("div",{className:"detail-value",children:"06/06/2025"})]})]})]}),e.jsxs("div",{className:"table-section-heading",children:[e.jsx("h3",{children:"Obsolete Document Entries"}),e.jsx("span",{children:"Required fields: Factory, Document Number and Document Name"})]}),e.jsx("div",{className:"table-scroll",children:e.jsxs("table",{className:"register-table",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"12%"}}),e.jsx("col",{style:{width:"15%"}}),e.jsx("col",{style:{width:"8%"}}),e.jsx("col",{style:{width:"9%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"10%"}}),e.jsx("col",{style:{width:"11%"}}),e.jsx("col",{style:{width:"5%"}})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document Number"}),e.jsx("th",{children:"Document Name"}),e.jsx("th",{children:"Version Number"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Storage"}),e.jsx("th",{children:"Retention Time"}),e.jsx("th",{children:"Protection"}),e.jsx("th",{children:"Disposition of Document"}),e.jsx("th",{className:"no-print",children:"Action"})]})}),e.jsx("tbody",{children:i.map(t=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsxs("select",{value:t.factory,onChange:a=>m(t.id,"factory",a.target.value),className:"distribution-input",required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})}),e.jsx("td",{children:r(t.documentNumber,a=>m(t.id,"documentNumber",a),"text","Document No.")}),e.jsx("td",{children:r(t.documentName,a=>m(t.id,"documentName",a),"text","Document Name")}),e.jsx("td",{children:r(t.versionNumber,a=>m(t.id,"versionNumber",a),"text","Version")}),e.jsx("td",{children:r(t.date,a=>m(t.id,"date",a),"date")}),e.jsx("td",{children:r(t.storage,a=>m(t.id,"storage",a),"text","Storage")}),e.jsx("td",{children:r(t.retentionTime,a=>m(t.id,"retentionTime",a),"text","Retention")}),e.jsx("td",{children:r(t.protection,a=>m(t.id,"protection",a),"text","Protection")}),e.jsx("td",{children:r(t.disposition,a=>m(t.id,"disposition",a),"text","Disposition")}),e.jsx("td",{className:"no-print",children:e.jsxs("div",{className:"row-actions",children:[e.jsx("button",{type:"button",className:"save-row-btn",disabled:x!==null,onClick:()=>E(t),children:x===t.id?"Saving...":"Save"}),e.jsx("button",{type:"button",className:"remove-row-btn",disabled:x===t.id,onClick:()=>D(t.id),children:"Remove"})]})})]},t.id))})]})}),e.jsx("div",{className:"add-row-area no-print",children:e.jsx("button",{type:"button",className:"add-row-btn",onClick:l,children:"+ Add Another Entry Row"})}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc. No.: MS Q001 LOG 3"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 3"})]})]})}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Obsolete Document Register"}),e.jsx("p",{children:"All obsolete document records saved in the Quality System."})]}),e.jsxs("span",{className:"record-count",children:[o.length," records"]})]}),e.jsx("div",{className:"register-filters",style:{marginBottom:20},children:e.jsx("input",{className:"register-search",placeholder:"Search factory, document number or name...",value:p,onChange:t=>y(t.target.value)})}),N?e.jsx("div",{className:"empty-state",children:"Loading saved obsolete document records..."}):o.length===0?e.jsx("div",{className:"empty-state",children:"No matching obsolete document entries found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Document Number"}),e.jsx("th",{children:"Document Name"}),e.jsx("th",{children:"Version Number"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Storage"}),e.jsx("th",{children:"Retention Time"}),e.jsx("th",{children:"Protection"}),e.jsx("th",{children:"Disposition"})]})}),e.jsx("tbody",{children:o.map(t=>{const a=t.form_data||{};return e.jsxs("tr",{children:[e.jsx("td",{children:c(t)}),e.jsx("td",{children:a.documentNumber||"-"}),e.jsx("td",{children:a.documentName||"-"}),e.jsx("td",{children:a.versionNumber||"-"}),e.jsx("td",{children:a.date||"-"}),e.jsx("td",{children:a.storage||"-"}),e.jsx("td",{children:a.retentionTime||"-"}),e.jsx("td",{children:a.protection||"-"}),e.jsx("td",{children:a.disposition||"-"})]},t.id)})})]})})]})]})}const U=()=>{const i=new Date;return`${i.getFullYear()}-${String(i.getMonth()+1).padStart(2,"0")}-${String(i.getDate()).padStart(2,"0")}`},z=()=>({factory:"",originatorName:"",productDescription:"",contractorSupplier:"",batchNumber:"",quantity:"",ncrNumber:"",foundDuring:[],otherActivity:"",problemDescription:"",immediateAction:"",dateOfOccurrence:"",reportingSignature:"",reportingDate:"",criticality:"",retestingResult:"",disposition:"",otherDisposition:"",requiredAction:"",owner:"",dateAssigned:U(),investigationDueDate:"",correctiveActionCompleted:"",productionManagerName:"",productionManagerDate:"",productionManagerSignature:"",correctiveActionApproval:"",capaRcaNumber:"",ownerName:"",ownerDate:"",ownerSignature:"",qualityDesignee:"",plannedDispositionCompleted:"",newNCRNumber:"",qualitySignature:"",qualityDate:""});function te(){const[i,h]=d.useState(z()),[f,w]=d.useState("new"),[g,T]=d.useState([]),[N,R]=d.useState(!1),[x,C]=d.useState(!1),[j,O]=d.useState(""),p=(r,t)=>{h(a=>{const s={...a,[r]:t};if(r==="criticality"||r==="dateAssigned"){const n=s.criticality==="High"?10:s.criticality==="Medium/Moderate"?15:s.criticality==="Low"?20:0;if(n&&s.dateAssigned){const u=new Date(`${s.dateAssigned}T00:00:00`);u.setDate(u.getDate()+n),s.investigationDueDate=`${u.getFullYear()}-${String(u.getMonth()+1).padStart(2,"0")}-${String(u.getDate()).padStart(2,"0")}`}else s.investigationDueDate=""}return s})},y=async()=>{R(!0);try{const{data:r,error:t}=await v.from("fms_quality_records").select("*").eq("title","Non-Conformance Report").order("created_at",{ascending:!1});if(t)throw t;T(r||[])}catch(r){alert("Could not load NCR records: "+r.message)}finally{R(!1)}};d.useEffect(()=>{y()},[]);const k=async r=>{const t=new Date().getFullYear(),a=r==="Rockwood"?"R":"N",{data:s,error:n}=await v.from("fms_quality_records").select("record_number, form_data").eq("title","Non-Conformance Report").eq("factory",r.toLowerCase());if(n)throw n;const u=(s||[]).map(S=>{var Q;const _=((Q=S.form_data)==null?void 0:Q.ncrNumber)||S.record_number||"",A=String(_).match(new RegExp(`NCR\\s+(\\d+)/${t}/${a}`));return A?Number(A[1]):0}),b=Math.max(0,...u)+1;return`NCR ${String(b).padStart(2,"0")}/${t}/${a}`},m=async()=>{if(!x){if(!i.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!i.originatorName.trim()||!i.productDescription.trim()||!i.batchNumber.trim()||!i.problemDescription.trim()){alert("Please complete the Factory, Originator Name, Product Description, Batch Number and Problem Description.");return}C(!0);try{const{data:r,error:t}=await v.auth.getUser();if(t||!r.user){alert("You must be logged in to save this NCR.");return}const a=await k(i.factory),s={...i,ncrNumber:a},{error:n}=await v.from("fms_quality_records").insert({title:"Non-Conformance Report",record_number:a,factory:i.factory.toLowerCase(),form_data:{...s,factory:i.factory},status:"submitted",created_by:r.user.id,updated_by:r.user.id,submitted_at:new Date().toISOString()});if(n)throw n;alert(`Non-Conformance Report saved successfully.
NCR Number: ${a}`),h(z()),await y(),w("master")}catch(r){console.error("NCR save error:",r),alert("Could not save NCR: "+r.message)}finally{C(!1)}}},E=r=>{const t=i.foundDuring.includes(r);p("foundDuring",t?i.foundDuring.filter(a=>a!==r):[...i.foundDuring,r])},l=(r,t,a="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:r}),e.jsx("input",{type:a,value:String(i[t]||""),onChange:s=>p(t,s.target.value)})]}),D=(r,t)=>e.jsxs("label",{className:"ncr-field ncr-full",children:[e.jsx("span",{children:r}),e.jsx("textarea",{value:String(i[t]||""),onChange:a=>p(t,a.target.value),rows:4})]}),o=(r,t,a)=>e.jsxs("div",{className:"ncr-choice-group",children:[e.jsx("strong",{children:r}),e.jsx("div",{className:"ncr-options",children:a.map(s=>e.jsxs("label",{children:[e.jsx("input",{type:"radio",name:String(t),checked:i[t]===s,onChange:()=>p(t,s)}),s]},s))})]}),c=g.filter(r=>{const t=r.form_data||{};return[r.record_number,r.factory,t.factory,t.originatorName,t.productDescription,t.batchNumber,r.status].join(" ").toLowerCase().includes(j.toLowerCase())});return e.jsxs("div",{className:"quality-register-page ncr-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Non-Conformance Report"}),e.jsx("p",{children:"Quality Management System · MS Q002 FORM 1"})]}),e.jsx("div",{className:"register-actions",children:f==="new"?e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Form"}):e.jsx("button",{type:"button",className:"register-btn",onClick:y,disabled:N,children:"Refresh Records"})})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${f==="new"?"active":""}`,onClick:()=>w("new"),children:"New NCR"}),e.jsxs("button",{type:"button",className:`register-tab ${f==="master"?"active":""}`,onClick:()=>w("master"),children:["Master NCR Register (",g.length,")"]})]}),f==="new"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("div",{className:"ncr-logo",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsxs("div",{className:"ncr-title",children:["Non-Conformance",e.jsx("br",{}),"Report Form"]}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsxs("div",{children:[e.jsx("span",{children:"Doc No.:"}),e.jsx("strong",{children:"MS Q002 FORM 1"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Issue Date:"}),e.jsx("strong",{children:"03/07/2023"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Version No.:"}),e.jsx("strong",{children:"1"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Rev Date:"}),e.jsx("strong",{children:"14/01/2025"})]})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By:"}),e.jsx("input",{value:" ",readOnly:!0}),e.jsx("span",{children:"Approved By:"}),e.jsx("input",{value:" ",readOnly:!0})]})]}),e.jsx("div",{className:"ncr-factory no-print",children:e.jsxs("label",{children:["Factory *",e.jsxs("select",{value:i.factory,onChange:r=>p("factory",r.target.value),required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]})}),e.jsxs("div",{className:"ncr-factory print-only",children:["Factory: ",i.factory||"Not selected"]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 1: (To be completed by Reporting Party)"}),e.jsxs("div",{className:"ncr-grid",children:[l("Originator Name:","originatorName"),l("Product Description:","productDescription"),l("Contractor/Supplier:","contractorSupplier"),l("Batch Number:","batchNumber"),l("Qty:","quantity"),l("NCR Number:","ncrNumber")]}),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"FOUND DURING WHAT ACTIVITY:"}),e.jsx("div",{className:"ncr-options ncr-activity",children:["Incoming Inspection","Final Inspection","In-process Inspection","Other"].map(r=>e.jsxs("label",{children:[e.jsx("input",{type:"checkbox",checked:i.foundDuring.includes(r),onChange:()=>E(r)}),r]},r))}),i.foundDuring.includes("Other")&&l("Other activity:","otherActivity")]}),D("PROBLEM DESCRIPTION (attach any supporting documents):","problemDescription"),D("IMMEDIATE ACTION TAKEN:","immediateAction"),e.jsxs("div",{className:"ncr-grid ncr-bottom-fields",children:[l("Date of Occurrence:","dateOfOccurrence","date"),l("Reporting Party Signature:","reportingSignature"),l("Date:","reportingDate","date")]})]}),e.jsxs("div",{className:"ncr-sheet ncr-second-page",children:[e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 2: (To be completed by Production Manager)"}),o("CRITICALITY LEVEL:","criticality",["High","Medium/Moderate","Low"]),D("RETESTING OF PRODUCT RESULT:","retestingResult"),o("DISPOSITION:","disposition",["Use-as-is","Rework","Return to supplier","Repair","Reject","Other"]),i.disposition==="Other"&&l("Other disposition:","otherDisposition"),D("REQUIRED ACTION:","requiredAction"),e.jsxs("div",{className:"ncr-grid",children:[l("Owner:","owner"),l("Date Assigned:","dateAssigned","date"),l("Investigation due date:","investigationDueDate","date")]}),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"Planned Disposition has been completed and Corrective action has been initiated (Attach proof of completion where possible)"}),o("","correctiveActionCompleted",["Yes","No"]),l("New NCR No. if no:","newNCRNumber"),e.jsxs("div",{className:"ncr-grid",children:[l("Name:","productionManagerName"),l("Date:","productionManagerDate","date"),l("Signature:","productionManagerSignature")]})]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 3: (To be completed by Owner & return to Production Manager for review prior to due date)"}),o("Approval of Corrective/Preventative Action:","correctiveActionApproval",["Yes","No"]),l("CAPA & RCA Form No. Issued:","capaRcaNumber"),e.jsxs("div",{className:"ncr-grid",children:[l("Name:","ownerName"),l("Date:","ownerDate","date"),l("Signature:","ownerSignature")]}),e.jsx("h3",{className:"ncr-section-heading",children:"SECTION 4: (To be completed by Quality Designee or Other (Specify) completes:"}),l("Quality Designee / Other:","qualityDesignee"),e.jsxs("div",{className:"ncr-block",children:[e.jsx("strong",{children:"CLOSING THE NON-CONFORMANCE"}),e.jsx("p",{children:"Planned Disposition has been completed and Corrective action has been initiated:"}),e.jsx("p",{children:"(Attach proof of completion where possible)"}),o("","plannedDispositionCompleted",["Yes","No"]),l("If No, new NCR No.:","newNCRNumber"),e.jsxs("div",{className:"ncr-grid",children:[l("Quality Designee Signature:","qualitySignature"),l("Date:","qualityDate","date")]})]})]}),e.jsx("div",{className:"no-print ncr-save-area",children:e.jsx("button",{type:"button",className:"register-btn primary",onClick:m,disabled:x,children:x?"Saving NCR...":"Save Non-Conformance Report"})})]}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Non-Conformance Register"}),e.jsx("p",{children:"Saved Non-Conformance Reports for Rockwood and Nguni."})]}),e.jsxs("span",{className:"record-count",children:[c.length," records"]})]}),e.jsx("input",{className:"register-search",placeholder:"Search factory, NCR number, product or batch...",value:j,onChange:r=>O(r.target.value)}),N?e.jsx("div",{className:"empty-state",children:"Loading NCR records..."}):c.length===0?e.jsx("div",{className:"empty-state",children:"No NCR records found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"NCR Number"}),e.jsx("th",{children:"Product"}),e.jsx("th",{children:"Batch Number"}),e.jsx("th",{children:"Criticality"}),e.jsx("th",{children:"Investigation Due"}),e.jsx("th",{children:"Status"}),e.jsx("th",{children:"Date Created"})]})}),e.jsx("tbody",{children:c.map(r=>{const t=r.form_data||{},a=String(r.factory||t.factory||"");return e.jsxs("tr",{children:[e.jsx("td",{children:a.toLowerCase()==="rockwood"?"Rockwood":a.toLowerCase()==="nguni"?"Nguni":"-"}),e.jsx("td",{children:r.record_number}),e.jsx("td",{children:t.productDescription||"-"}),e.jsx("td",{children:t.batchNumber||"-"}),e.jsx("td",{children:t.criticality||"-"}),e.jsx("td",{children:t.investigationDueDate||"-"}),e.jsx("td",{children:r.status||"-"}),e.jsx("td",{children:r.created_at?new Date(r.created_at).toLocaleDateString():"-"})]},r.id)})})]})})]})]})}const B=()=>({factory:"",dateQuarantined:U(),tagNumber:"",supplierName:"",batchNumber:"",productDescription:"",reasonForQuarantine:"",customerName:"",quantityInQuarantine:"",quarantineType:"",ncrNumber:"",quarantineName:"",quarantineSignature:"",deliveryNoteNumber:"",releaseDecision:"",releaseSignature:"",releaseDate:""});function re(){const[i,h]=d.useState(B()),[f,w]=d.useState("new"),[g,T]=d.useState([]),[N,R]=d.useState(!1),[x,C]=d.useState(!1),[j,O]=d.useState(""),p=(o,c)=>{h(r=>({...r,[o]:c}))},y=async()=>{R(!0);try{const{data:o,error:c}=await v.from("fms_quality_records").select("*").eq("title","Quarantine Tag").order("created_at",{ascending:!1});if(c)throw c;T(o||[])}catch(o){alert("Could not load quarantine records: "+o.message)}finally{R(!1)}};d.useEffect(()=>{y()},[]);const k=async()=>{if(!x){if(!i.factory){alert("Please select a factory: Rockwood or Nguni.");return}if(!i.tagNumber.trim()||!i.productDescription.trim()||!i.reasonForQuarantine.trim()){alert("Please complete the Tag Number, Product Description and Reason for Quarantine.");return}C(!0);try{const{data:o,error:c}=await v.auth.getUser();if(c||!o.user){alert("You must be logged in to save this quarantine tag.");return}const r={...i},{error:t}=await v.from("fms_quality_records").insert({title:"Quarantine Tag",record_number:i.tagNumber.trim(),factory:i.factory.toLowerCase(),form_data:{...r,factory:i.factory},status:i.releaseDecision?"released":"quarantined",created_by:o.user.id,updated_by:o.user.id,submitted_at:new Date().toISOString()});if(t)throw t;alert("Quarantine Tag saved successfully!"),h(B()),await y(),w("master")}catch(o){console.error("Quarantine Tag save error:",o),alert("Could not save Quarantine Tag: "+o.message)}finally{C(!1)}}},m=(o,c,r="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:o}),e.jsx("input",{type:r,value:i[c],onChange:t=>p(c,t.target.value)})]}),E=(o,c)=>e.jsxs("label",{className:"ncr-field ncr-full",children:[e.jsx("span",{children:o}),e.jsx("textarea",{rows:3,value:i[c],onChange:r=>p(c,r.target.value)})]}),l=(o,c,r)=>e.jsxs("div",{className:"ncr-choice-group",children:[e.jsx("strong",{children:o}),e.jsx("div",{className:"ncr-options",children:r.map(t=>e.jsxs("label",{children:[e.jsx("input",{type:"radio",name:c,checked:i[c]===t,onChange:()=>p(c,t)}),t]},t))})]}),D=g.filter(o=>{const c=o.form_data||{};return[o.record_number,o.factory,c.tagNumber,c.batchNumber,c.productDescription,c.supplierName,c.customerName,c.releaseDecision].join(" ").toLowerCase().includes(j.toLowerCase())});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsxs("div",{className:"register-heading",children:[e.jsx("h1",{children:"Quarantine Tag"}),e.jsx("p",{children:"Quality Management System · MS Q002 FORM 2"})]}),e.jsx("div",{className:"register-actions",children:f==="new"?e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Tag"}):e.jsx("button",{type:"button",className:"register-btn",onClick:y,disabled:N,children:"Refresh Records"})})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${f==="new"?"active":""}`,onClick:()=>w("new"),children:"New Quarantine Tag"}),e.jsxs("button",{type:"button",className:`register-tab ${f==="master"?"active":""}`,onClick:()=>w("master"),children:["Master Quarantine Register (",g.length,")"]})]}),f==="new"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("div",{className:"ncr-logo",children:e.jsx("img",{src:"/images/mslogo.png",alt:"Maharaja's Spices"})}),e.jsx("div",{className:"ncr-title",children:"QUARANTINE TAG"}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsxs("div",{children:[e.jsx("span",{children:"Doc No.:"}),e.jsx("strong",{children:"MS Q002 FORM 2"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Issue Date:"}),e.jsx("strong",{children:"12/06/2019"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Version No.:"}),e.jsx("strong",{children:"2"})]}),e.jsxs("div",{children:[e.jsx("span",{children:"Rev Date:"}),e.jsx("strong",{children:"14/01/2025"})]})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By:"}),e.jsx("strong",{children:"Tania Naicker"}),e.jsx("span",{children:"Approved By:"}),e.jsx("strong",{children:"Livinia Govender"})]})]}),e.jsx("div",{className:"ncr-factory no-print",children:e.jsxs("label",{children:["Factory *",e.jsxs("select",{value:i.factory,onChange:o=>p("factory",o.target.value),required:!0,children:[e.jsx("option",{value:"",children:"Select factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]})}),e.jsxs("div",{className:"ncr-factory print-only",children:["Factory: ",i.factory||"Not selected"]}),e.jsxs("div",{className:"ncr-grid",children:[m("Date Quarantined:","dateQuarantined","date"),m("Tag No.:","tagNumber"),m("Name of Supplier:","supplierName"),m("Batch Number:","batchNumber"),m("Product Description:","productDescription"),m("Name of Customer:","customerName"),m("Quantity in Quarantine:","quantityInQuarantine")]}),E("Reason for Quarantine:","reasonForQuarantine"),l("Quarantine Type:","quarantineType",["Rework","Scrap"]),e.jsxs("div",{className:"ncr-grid",children:[m("NCR No.:","ncrNumber"),m("Name:","quarantineName"),m("Delivery Note No.:","deliveryNoteNumber"),m("Signature:","quarantineSignature")]}),e.jsx("h3",{className:"ncr-section-heading",children:"RELEASE"}),l("Release Decision:","releaseDecision",["Return to Supplier","Accept on concession","Return to stock","Sell on concession"]),e.jsxs("div",{className:"ncr-grid",children:[m("Release Signature:","releaseSignature"),m("Release Date:","releaseDate","date")]}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc No.: MS Q002 FORM 2"}),e.jsx("span",{children:"Controlled Quality Document"}),e.jsx("span",{children:"Version No.: 2"})]})]}),e.jsx("div",{className:"no-print ncr-save-area",children:e.jsx("button",{type:"button",className:"register-btn primary",onClick:k,disabled:x,children:x?"Saving...":"Save Quarantine Tag"})})]}):e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"paper-heading",children:[e.jsxs("div",{children:[e.jsx("h2",{children:"Master Quarantine Register"}),e.jsx("p",{children:"Quarantine records for Rockwood and Nguni."})]}),e.jsxs("span",{className:"record-count",children:[D.length," records"]})]}),e.jsx("input",{className:"register-search",placeholder:"Search tag, factory, product, batch or supplier...",value:j,onChange:o=>O(o.target.value)}),N?e.jsx("div",{className:"empty-state",children:"Loading quarantine records..."}):D.length===0?e.jsx("div",{className:"empty-state",children:"No quarantine records found."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Tag No."}),e.jsx("th",{children:"Date Quarantined"}),e.jsx("th",{children:"Product"}),e.jsx("th",{children:"Batch Number"}),e.jsx("th",{children:"Supplier"}),e.jsx("th",{children:"Quantity"}),e.jsx("th",{children:"Quarantine Type"}),e.jsx("th",{children:"Release Decision"}),e.jsx("th",{children:"Status"})]})}),e.jsx("tbody",{children:D.map(o=>{const c=o.form_data||{},r=String(o.factory||c.factory||"");return e.jsxs("tr",{children:[e.jsx("td",{children:r.toLowerCase()==="rockwood"?"Rockwood":r.toLowerCase()==="nguni"?"Nguni":"-"}),e.jsx("td",{children:o.record_number||"-"}),e.jsx("td",{children:c.dateQuarantined||"-"}),e.jsx("td",{children:c.productDescription||"-"}),e.jsx("td",{children:c.batchNumber||"-"}),e.jsx("td",{children:c.supplierName||"-"}),e.jsx("td",{children:c.quantityInQuarantine||"-"}),e.jsx("td",{children:c.quarantineType||"-"}),e.jsx("td",{children:c.releaseDecision||"-"}),e.jsx("td",{children:o.status||"-"})]},o.id)})})]})})]})]})}const G=()=>({factory:"",date:new Date().toISOString().slice(0,10),requesterName:"",companyName:"",address:"",contactPerson:"",deliveryNoteNumber:"",invoiceNumber:"",productDescription:"",ncrNumber:"",reasonForConcession:"",acceptanceReason:"",acceptingSignature:"",acceptingDate:"",items:[{id:1,itemNumber:"1",signature:"",price:""}]});function se(){const[i,h]=d.useState(G()),[f,w]=d.useState([]),[g,T]=d.useState("new"),[N,R]=d.useState(!1),[x,C]=d.useState(!1),[j,O]=d.useState(""),p=async()=>{R(!0);const{data:r,error:t}=await v.from("fms_quality_records").select("*").eq("title","Concession Record").order("created_at",{ascending:!1});t?(console.error("Error loading concession records:",t),alert("Could not load the Concession Register.")):w(r||[]),R(!1)};d.useEffect(()=>{p()},[]);const y=(r,t)=>{h(a=>({...a,[r]:t}))},k=(r,t,a)=>{h(s=>({...s,items:s.items.map(n=>n.id===r?{...n,[t]:a}:n)}))},m=()=>{h(r=>({...r,items:[...r.items,{id:Date.now(),itemNumber:String(r.items.length+1),signature:"",price:""}]}))},E=r=>{h(t=>({...t,items:t.items.filter(a=>a.id!==r).map((a,s)=>({...a,itemNumber:String(s+1)}))}))},l=async()=>{if(!i.factory){alert("Please select a factory.");return}if(!i.date||!i.requesterName.trim()){alert("Please complete the date and name of the person requesting concession.");return}if(!i.productDescription.trim()||!i.reasonForConcession.trim()){alert("Please complete the product description and reason for concession.");return}C(!0);try{const{data:{user:r},error:t}=await v.auth.getUser();if(t||!r)throw new Error("Your session could not be verified. Please log in again.");const a=`CON-${new Date().getFullYear()}-${Date.now()}`,{error:s}=await v.from("fms_quality_records").insert({title:"Concession Record",record_number:a,factory:i.factory.toLowerCase(),form_data:{...i,factory:i.factory},status:"submitted",created_by:r.id,updated_by:r.id,submitted_at:new Date().toISOString()});if(s)throw s;alert(`Concession Record saved successfully.
Internal Reference: ${a}`),h(G()),await p(),T("master")}catch(r){console.error("Error saving concession record:",r),alert(r.message||"Could not save the Concession Record.")}finally{C(!1)}},D=f.filter(r=>{const t=r.form_data||{},a=j.toLowerCase();return[r.record_number,r.factory,t.requesterName,t.companyName,t.productDescription,t.ncrNumber].some(s=>String(s||"").toLowerCase().includes(a))}),o=(r,t,a="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:r}),e.jsx("input",{type:a,value:String(i[t]||""),onChange:s=>y(t,s.target.value)})]}),c=(r,t)=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:r}),e.jsx("textarea",{value:String(i[t]||""),onChange:a=>y(t,a.target.value),rows:3})]});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsx("h2",{children:"Concession Record"}),e.jsx("button",{className:"register-btn",type:"button",onClick:p,disabled:N,children:N?"Refreshing...":"Refresh Register"})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${g==="new"?"active":""}`,onClick:()=>T("new"),children:"New Concession Record"}),e.jsxs("button",{type:"button",className:`register-tab ${g==="master"?"active":""}`,onClick:()=>{T("master"),p()},children:["Master Concession Register (",f.length,")"]})]}),g==="new"&&e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("img",{className:"ncr-logo",src:"/images/mslogo.png",alt:"Maharaja's Spices"}),e.jsx("div",{className:"ncr-title",children:"CONCESSION RECORD"})]}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsx("span",{children:"Doc No.: MS Q002 FORM 3"}),e.jsx("span",{children:"Issue Date: 12/06/2019"}),e.jsx("span",{children:"Version No.: 2"}),e.jsx("span",{children:"Rev Date: 14/01/2025"})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By: Tania Naicker"}),e.jsx("span",{children:"Approved By: Livinia Govender"})]}),e.jsxs("div",{className:"ncr-factory",children:[e.jsxs("label",{children:["Factory:",e.jsxs("select",{value:i.factory,onChange:r=>y("factory",r.target.value),children:[e.jsx("option",{value:"",children:"Select Factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]}),e.jsx("span",{children:"Internal Record Ref.: Generated when saved"})]}),e.jsxs("div",{className:"ncr-grid",children:[o("Date","date","date"),o("Name of person requesting concession","requesterName"),o("Company Name","companyName"),o("Address","address"),o("Contact Person","contactPerson"),o("Delivery Note No.","deliveryNoteNumber"),o("Invoice No.","invoiceNumber"),o("NCR No.","ncrNumber")]}),e.jsx("div",{className:"ncr-section-heading",children:"PRODUCT DESCRIPTION"}),c("Product Description","productDescription"),e.jsx("div",{className:"ncr-section-heading",children:"REASON FOR CONCESSION"}),c("Reason for Concession","reasonForConcession"),e.jsx("div",{className:"ncr-section-heading",children:"CONCESSION DETAILS"}),e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"No."}),e.jsx("th",{children:"Signature"}),e.jsx("th",{children:"Price"}),e.jsx("th",{className:"no-print",children:"Action"})]})}),e.jsx("tbody",{children:i.items.map(r=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("input",{value:r.itemNumber,onChange:t=>k(r.id,"itemNumber",t.target.value)})}),e.jsx("td",{children:e.jsx("input",{value:r.signature,onChange:t=>k(r.id,"signature",t.target.value)})}),e.jsx("td",{children:e.jsx("input",{value:r.price,onChange:t=>k(r.id,"price",t.target.value)})}),e.jsx("td",{className:"no-print",children:e.jsx("button",{type:"button",className:"register-btn",onClick:()=>E(r.id),disabled:i.items.length===1,children:"Remove"})})]},r.id))})]}),e.jsx("button",{type:"button",className:"register-btn no-print",onClick:m,children:"+ Add Row"}),e.jsx("div",{className:"ncr-section-heading",children:"PERSON ACCEPTING CONCESSION"}),c("Reason for accepting / not accepting","acceptanceReason"),e.jsxs("div",{className:"ncr-grid",children:[o("Signature","acceptingSignature"),o("Date","acceptingDate","date")]}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"Doc No.: MS Q002 FORM 3"}),e.jsx("span",{children:"Page 1 of 1"}),e.jsx("span",{children:"Version No.: 2"})]})]}),e.jsxs("div",{className:"ncr-save-area no-print",children:[e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Form"}),e.jsx("button",{type:"button",className:"register-btn",onClick:l,disabled:x,children:x?"Saving...":"Save Concession Record"})]})]}),g==="master"&&e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"register-topbar",children:[e.jsx("h3",{children:"Master Concession Register"}),e.jsx("input",{className:"register-search",placeholder:"Search records...",value:j,onChange:r=>O(r.target.value)})]}),N?e.jsx("p",{children:"Loading records..."}):e.jsx("div",{className:"table-responsive",children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Internal Record Ref."}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Requester"}),e.jsx("th",{children:"Company"}),e.jsx("th",{children:"Product Description"}),e.jsx("th",{children:"NCR No."}),e.jsx("th",{children:"Status"})]})}),e.jsx("tbody",{children:D.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:8,children:"No concession records found."})}):D.map(r=>{var t,a,s,n,u;return e.jsxs("tr",{children:[e.jsx("td",{children:r.factory}),e.jsx("td",{children:r.record_number}),e.jsx("td",{children:((t=r.form_data)==null?void 0:t.date)||"—"}),e.jsx("td",{children:((a=r.form_data)==null?void 0:a.requesterName)||"—"}),e.jsx("td",{children:((s=r.form_data)==null?void 0:s.companyName)||"—"}),e.jsx("td",{children:((n=r.form_data)==null?void 0:n.productDescription)||"—"}),e.jsx("td",{children:((u=r.form_data)==null?void 0:u.ncrNumber)||"—"}),e.jsx("td",{children:r.status||"Submitted"})]},r.id)})})]})})]})]})}const V=()=>({id:Date.now(),date:new Date().toISOString().slice(0,10),number:"",description:"",reason:"",actioned:"",ncrNumber:"",supplier:"",deliveryNoteNumber:"",batchNumber:"",quantityAffected:"",quantityPerOutcome:"",outcome:"",comment:"",authorisedBy:""});function ae(){const[i,h]=d.useState(""),[f,w]=d.useState([V()]),[g,T]=d.useState([]),[N,R]=d.useState("new"),[x,C]=d.useState(!1),[j,O]=d.useState(!1),[p,y]=d.useState(""),k=["Return to supplier","Accepted on Concession","Returned to Stock","Sold on Concession","Scrapped"],m=async()=>{C(!0);const{data:t,error:a}=await v.from("fms_quality_records").select("*").eq("title","Quarantine Register").order("created_at",{ascending:!1});a?(console.error("Error loading quarantine register:",a),alert("Could not load the Quarantine Register.")):T(t||[]),C(!1)};d.useEffect(()=>{m()},[]);const E=(t,a,s)=>{w(n=>n.map(u=>u.id===t?{...u,[a]:s}:u))},l=()=>{w(t=>[...t,{...V(),id:Date.now()+t.length,number:String(t.length+1)}])},D=t=>{w(a=>a.filter(s=>s.id!==t).map((s,n)=>({...s,number:String(n+1)})))},o=async()=>{if(!i){alert("Please select a factory.");return}const t=f.filter(a=>a.description.trim()||a.reason.trim()||a.supplier.trim()||a.ncrNumber.trim());if(t.length===0){alert("Please enter at least one quarantine register entry.");return}O(!0);try{const{data:{user:a},error:s}=await v.auth.getUser();if(s||!a)throw new Error("Your session could not be verified. Please log in again.");const n=`QREG-${new Date().getFullYear()}-${Date.now()}`,{error:u}=await v.from("fms_quality_records").insert({title:"Quarantine Register",record_number:n,factory:i.toLowerCase(),form_data:{factory:i,entries:t},status:"submitted",created_by:a.id,updated_by:a.id,submitted_at:new Date().toISOString()});if(u)throw u;alert(`Quarantine Register saved successfully.
Internal Reference: ${n}`),h(""),w([V()]),await m(),R("master")}catch(a){console.error("Error saving quarantine register:",a),alert(a.message||"Could not save the Quarantine Register.")}finally{O(!1)}},c=g.filter(t=>{const a=p.toLowerCase(),s=t.form_data||{};return[t.record_number,t.factory,...(s.entries||[]).flatMap(n=>[n.description,n.supplier,n.ncrNumber,n.batchNumber,n.outcome])].some(n=>String(n||"").toLowerCase().includes(a))}),r=(t,a,s,n="text")=>e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:a}),e.jsx("input",{type:n,value:t[s],onChange:u=>E(t.id,s,u.target.value)})]});return e.jsxs("div",{className:"quality-register-page",children:[e.jsxs("div",{className:"register-topbar no-print",children:[e.jsx("h2",{children:"Quarantine Register"}),e.jsx("button",{type:"button",className:"register-btn",onClick:m,disabled:x,children:x?"Refreshing...":"Refresh Register"})]}),e.jsxs("div",{className:"register-tabs no-print",children:[e.jsx("button",{type:"button",className:`register-tab ${N==="new"?"active":""}`,onClick:()=>R("new"),children:"New Register Entry"}),e.jsxs("button",{type:"button",className:`register-tab ${N==="master"?"active":""}`,onClick:()=>{R("master"),m()},children:["Master Quarantine Register (",g.length,")"]})]}),N==="new"&&e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"ncr-sheet",children:[e.jsxs("div",{className:"ncr-header",children:[e.jsx("img",{className:"ncr-logo",src:"/images/mslogo.png",alt:"Maharaja's Spices"}),e.jsx("div",{className:"ncr-title",children:"QUARANTINE REGISTER"})]}),e.jsxs("div",{className:"ncr-document-details",children:[e.jsx("span",{children:"Doc No.: MS Q002 LOG 2"}),e.jsx("span",{children:"Issue Date: 12/06/2019"}),e.jsx("span",{children:"Revision Date: 14/01/2025"}),e.jsx("span",{children:"Version No.: 2"})]}),e.jsxs("div",{className:"ncr-approval-row",children:[e.jsx("span",{children:"Compiled By: Tania Naicker"}),e.jsx("span",{children:"Approved By: Livinia Govender"})]}),e.jsx("div",{className:"ncr-factory",children:e.jsxs("label",{children:["Factory:",e.jsxs("select",{value:i,onChange:t=>h(t.target.value),children:[e.jsx("option",{value:"",children:"Select Factory"}),e.jsx("option",{value:"Rockwood",children:"Rockwood"}),e.jsx("option",{value:"Nguni",children:"Nguni"})]})]})}),e.jsx("div",{className:"ncr-section-heading",children:"QUARANTINE REGISTER ENTRIES"}),f.map((t,a)=>e.jsxs("div",{className:"ncr-register-entry",children:[e.jsxs("div",{className:"ncr-section-heading",children:["Entry ",a+1,e.jsx("button",{type:"button",className:"register-btn no-print",onClick:()=>D(t.id),disabled:f.length===1,children:"Remove Entry"})]}),e.jsxs("div",{className:"ncr-grid",children:[r(t,"Date","date","date"),r(t,"No.","number"),r(t,"NCR No.","ncrNumber"),r(t,"Supplier","supplier"),r(t,"Delivery Note No.","deliveryNoteNumber"),r(t,"Batch No.","batchNumber"),r(t,"Quantity Affected","quantityAffected")]}),r(t,"Description of Material","description"),r(t,"Reason for Quarantine","reason"),e.jsxs("div",{className:"ncr-grid",children:[r(t,"Actioned","actioned"),e.jsxs("label",{className:"ncr-field",children:[e.jsx("span",{children:"Outcome"}),e.jsxs("select",{value:t.outcome,onChange:s=>E(t.id,"outcome",s.target.value),children:[e.jsx("option",{value:"",children:"Select Outcome"}),k.map(s=>e.jsx("option",{value:s,children:s},s))]})]}),r(t,"Quantity per Outcome","quantityPerOutcome"),r(t,"Authorised By","authorisedBy")]}),r(t,"Comment","comment")]},t.id)),e.jsx("button",{type:"button",className:"register-btn no-print",onClick:l,children:"+ Add Register Entry"}),e.jsxs("div",{className:"document-footer",children:[e.jsx("span",{children:"DOC No.: MS Q002 LOG 2"}),e.jsx("span",{children:"Page 1 of 1"}),e.jsx("span",{children:"Version No.: 2"})]})]}),e.jsxs("div",{className:"ncr-save-area no-print",children:[e.jsx("button",{type:"button",className:"register-btn",onClick:()=>window.print(),children:"Print Register"}),e.jsx("button",{type:"button",className:"register-btn",onClick:o,disabled:j,children:j?"Saving...":"Save Register"})]})]}),N==="master"&&e.jsxs("div",{className:"register-paper",children:[e.jsxs("div",{className:"register-topbar",children:[e.jsx("h3",{children:"Master Quarantine Register"}),e.jsx("input",{className:"register-search",placeholder:"Search register...",value:p,onChange:t=>y(t.target.value)})]}),x?e.jsx("p",{children:"Loading register..."}):e.jsx("div",{className:"table-responsive",children:e.jsxs("table",{className:"master-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factory"}),e.jsx("th",{children:"Internal Reference"}),e.jsx("th",{children:"Date"}),e.jsx("th",{children:"Description of Material"}),e.jsx("th",{children:"Supplier"}),e.jsx("th",{children:"Batch No."}),e.jsx("th",{children:"NCR No."}),e.jsx("th",{children:"Outcome"})]})}),e.jsx("tbody",{children:c.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:8,children:"No quarantine register entries found."})}):c.flatMap(t=>{var a;return(((a=t.form_data)==null?void 0:a.entries)||[]).map(s=>e.jsxs("tr",{children:[e.jsx("td",{children:t.factory}),e.jsx("td",{children:t.record_number}),e.jsx("td",{children:s.date||"—"}),e.jsx("td",{children:s.description||"—"}),e.jsx("td",{children:s.supplier||"—"}),e.jsx("td",{children:s.batchNumber||"—"}),e.jsx("td",{children:s.ncrNumber||"—"}),e.jsx("td",{children:s.outcome||"—"})]},`${t.id}-${s.id}`))})})]})})]})]})}function ie(){const i=J(),h=new URLSearchParams(i.search).get("category");return e.jsxs("div",{className:"quality-register-page",children:[h==="Document Control Distribution"&&e.jsx(Z,{}),h==="Obsolete Document List"&&e.jsx(ee,{}),h==="Non-Conformance Report"&&e.jsx(te,{}),h==="Quarantine Tag"&&e.jsx(re,{}),h==="Concession Record"&&e.jsx(se,{}),h==="Quarantine Register"&&e.jsx(ae,{}),!h&&e.jsx("div",{className:"register-paper",children:"Select a form from the Forms section in the sidebar."}),h&&!["Document Control Distribution","Obsolete Document List","Non-Conformance Report","Quarantine Tag","Concession Record","Quarantine Register"].includes(h)&&e.jsx("div",{className:"register-paper",children:"Form not found."})]})}export{ie as default};
