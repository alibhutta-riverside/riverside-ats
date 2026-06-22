import { useState } from "react";
import * as XLSX from "xlsx";

// ─── PIPELINE STAGES ──────────────────────────────────────────────────────────
const STAGES = [
  { id:"demand",     label:"Demand Received",         color:"#6366F1" },
  { id:"sourcing",   label:"CV Sourcing",              color:"#8B5CF6" },
  { id:"interview",  label:"Interviews",               color:"#A855F7" },
  { id:"shortlist",  label:"Shortlisted",              color:"#3B82F6" },
  { id:"offer",      label:"Offer Letter",             color:"#0EA5E9" },
  { id:"contract",   label:"Contract Signed",          color:"#14B8A6" },
  { id:"docs",       label:"CNIC & Documents",         color:"#10B981" },
  { id:"tradetest",  label:"Trade Test (Takamol)",     color:"#F59E0B" },
  { id:"medical",    label:"Medical (GAMCA)",          color:"#F97316" },
  { id:"mofa",       label:"MOFA Attestation",         color:"#EF4444" },
  { id:"evisa",      label:"Electronic Visa (Muqeem)", color:"#EC4899" },
  { id:"visaauth",   label:"Visa Authorisation",       color:"#6366F1" },
  { id:"ppsubmit",   label:"Passport Submission",      color:"#8B5CF6" },
  { id:"stamping",   label:"Visa Stamping",            color:"#3B82F6" },
  { id:"beoe",       label:"BEOE / Protector",         color:"#0EA5E9" },
  { id:"flight",     label:"Flight Booking",           color:"#14B8A6" },
  { id:"deployed",   label:"Deployed ✓",              color:"#10B981" },
  { id:"rejected",   label:"Rejected / Cancelled",    color:"#6B7280" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s=>[s.id,s]));
const STAGE_IDS = STAGES.map(s=>s.id);

const uid = () => Math.random().toString(36).slice(2,9);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const today = () => new Date().toLocaleDateString("en-GB");

const EMPTY_C = {
  name:"",fatherName:"",cnic:"",phone:"",trade:"",experience:"",
  passport:"",passportExpiry:"",stage:"demand",jobId:"",
  offerLetter:"",contract:"",
  medicalStatus:"",medicalDate:"",
  beoeStatus:"",electronicNo:"",
  visaAuthDate:"",visaNo:"",visaIssueDate:"",
  ppSubStatus:"",ppSubDate:"",ppDispatchDate:"",ppReceivedDate:"",
  stampingDate:"",flightDate:"",
  tradeTestStatus:"",tradeTestDate:"",
  objection:"",remarks:""
};

const EMPTY_J = {
  ref:"",client:"",country:"Saudi Arabia",city:"",
  position:"",vacancies:1,salary:"",deadline:"",
  status:"Open",contact:"",notes:""
};

const DEMO_JOBS = [
  {id:"j1",ref:"SA-2025-001",client:"Al Rajhi Contracting",country:"Saudi Arabia",city:"Riyadh",position:"Civil Engineer",vacancies:5,salary:"3,500",deadline:"2025-09-30",status:"Open",contact:"Ahmed Al-Otaibi",notes:"Vision 2030 project"},
  {id:"j2",ref:"SA-2025-002",client:"Nestle Waters KSA",country:"Saudi Arabia",city:"Jeddah",position:"Salesman Driver",vacancies:10,salary:"2,200",deadline:"2025-08-15",status:"Open",contact:"Reem Al Harbi",notes:"Urgent requirement"},
  {id:"j3",ref:"SA-2025-003",client:"Denys Arabia",country:"Saudi Arabia",city:"Dammam",position:"Electrician",vacancies:8,salary:"2,800",deadline:"2025-10-01",status:"Open",contact:"HR Manager",notes:""},
];

const DEMO_CANDS = [
  {id:"c1",name:"Muhammad Usman",fatherName:"Muhammad Iqbal",cnic:"35202-1234567-1",phone:"+92 300 1234567",trade:"Civil Engineer",experience:"5",passport:"AC1234567",passportExpiry:"2027-06-01",stage:"medical",jobId:"j1",addedDate:"01/06/2025",offerLetter:"Yes",contract:"Yes",medicalStatus:"Pending",medicalDate:"2025-06-20",beoeStatus:"",electronicNo:"",visaAuthDate:"",visaNo:"",visaIssueDate:"",ppSubStatus:"",ppSubDate:"",ppDispatchDate:"",ppReceivedDate:"",stampingDate:"",flightDate:"",tradeTestStatus:"Pass",tradeTestDate:"2025-05-15",objection:"",remarks:"Strong profile"},
  {id:"c2",name:"Tariq Mehmood",fatherName:"Muhammad Sharif",cnic:"35202-7654321-3",phone:"+92 301 9876543",trade:"Civil Engineer",experience:"3",passport:"AC7654321",passportExpiry:"2026-12-15",stage:"ppsubmit",jobId:"j1",addedDate:"03/06/2025",offerLetter:"Yes",contract:"Yes",medicalStatus:"Yes",medicalDate:"2025-05-20",beoeStatus:"Yes",electronicNo:"SA-E-887766",visaAuthDate:"2025-06-01",visaNo:"SA8877665",visaIssueDate:"2025-06-05",ppSubStatus:"Submitted",ppSubDate:"2025-06-07",ppDispatchDate:"2025-06-07",ppReceivedDate:"",stampingDate:"",flightDate:"",tradeTestStatus:"Pass",tradeTestDate:"2025-05-10",objection:"",remarks:""},
  {id:"c3",name:"Asif Ali Khan",fatherName:"Ali Khan",cnic:"35202-1122334-5",phone:"+92 333 1122334",trade:"Civil Engineer",experience:"7",passport:"AC1122334",passportExpiry:"2028-03-20",stage:"shortlist",jobId:"j1",addedDate:"05/06/2025",offerLetter:"Pending",contract:"",medicalStatus:"",medicalDate:"",beoeStatus:"",electronicNo:"",visaAuthDate:"",visaNo:"",visaIssueDate:"",ppSubStatus:"",ppSubDate:"",ppDispatchDate:"",ppReceivedDate:"",stampingDate:"",flightDate:"",tradeTestStatus:"",tradeTestDate:"",objection:"",remarks:"Interview 20 June"},
  {id:"c4",name:"Waqar Hussain",fatherName:"Hussain Muhammad",cnic:"35202-9988776-7",phone:"+92 345 9988776",trade:"Salesman Driver",experience:"2",passport:"AC9988776",passportExpiry:"2025-08-10",stage:"deployed",jobId:"j2",addedDate:"10/05/2025",offerLetter:"Yes",contract:"Yes",medicalStatus:"Yes",medicalDate:"2025-04-30",beoeStatus:"Yes",electronicNo:"SA-E-112233",visaAuthDate:"2025-05-10",visaNo:"SA1122334",visaIssueDate:"2025-05-15",ppSubStatus:"Received",ppSubDate:"2025-05-18",ppDispatchDate:"2025-05-18",ppReceivedDate:"2025-05-22",stampingDate:"2025-05-25",flightDate:"2025-06-01",tradeTestStatus:"Pass",tradeTestDate:"2025-04-20",objection:"",remarks:"Joined duty 02 Jun"},
  {id:"c5",name:"Bilal Ahmed",fatherName:"Ahmed Khan",cnic:"35202-5566778-9",phone:"+92 321 5566778",trade:"Salesman Driver",experience:"4",passport:"AC5566778",passportExpiry:"2027-11-30",stage:"medical",jobId:"j2",addedDate:"12/05/2025",offerLetter:"Yes",contract:"Yes",medicalStatus:"Pending",medicalDate:"2025-06-18",beoeStatus:"",electronicNo:"",visaAuthDate:"",visaNo:"",visaIssueDate:"",ppSubStatus:"",ppSubDate:"",ppDispatchDate:"",ppReceivedDate:"",stampingDate:"",flightDate:"",tradeTestStatus:"Pass",tradeTestDate:"2025-05-25",objection:"",remarks:""},
  {id:"c6",name:"Rana Saleem",fatherName:"Saleem Akhtar",cnic:"35202-3344556-1",phone:"+92 333 3344556",trade:"Electrician",experience:"6",passport:"AC3344556",passportExpiry:"2028-01-15",stage:"interview",jobId:"j3",addedDate:"08/06/2025",offerLetter:"",contract:"",medicalStatus:"",medicalDate:"",beoeStatus:"",electronicNo:"",visaAuthDate:"",visaNo:"",visaIssueDate:"",ppSubStatus:"",ppSubDate:"",ppDispatchDate:"",ppReceivedDate:"",stampingDate:"",flightDate:"",tradeTestStatus:"",tradeTestDate:"",objection:"",remarks:"Good candidate"},
];

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
function exportExcel(cands, jobs, jobId) {
  const job = jobs.find(j=>j.id===jobId);
  if (!job) return;
  const list = cands.filter(c=>c.jobId===jobId);
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Cover / Summary ──
  const filled = list.filter(c=>c.stage==="deployed").length;
  const coverRows = [
    ["","","","","","",""],
    ["","RIVERSIDE ENTERPRISES RECRUITMENT CONSULTANTS","","","","",""],
    ["","Overseas Employment Promoters | Govt. of Pakistan Licensed","","","","",""],
    ["","Office: Lahore, Pakistan | Overseas Director: Mr. Umer Chaudhry, Saudi Arabia","","","","",""],
    ["","","","","","",""],
    ["","CLIENT STATUS REPORT","","","","",""],
    ["","","","","","",""],
    ["","Client:",job.client,"","Country:",job.country,""],
    ["","Order Ref:",job.ref,"","City:",job.city,""],
    ["","Position:",job.position,"","Vacancies:",job.vacancies,""],
    ["","Salary (SAR):",job.salary,"","Contact:",job.contact,""],
    ["","Report Date:",today(),"","Deadline:",fmtDate(job.deadline),""],
    ["","","","","","",""],
    ["","PIPELINE SUMMARY","","","","",""],
    ["","","","","","",""],
  ];

  let stageRows = [["","Stage","Candidates","","","",""]];
  STAGES.forEach(s=>{
    const n = list.filter(c=>c.stage===s.id).length;
    if(n>0) stageRows.push(["",s.label,n,"","","",""]);
  });
  stageRows.push(["","","","","","",""]);
  stageRows.push(["","TOTAL CANDIDATES",list.length,"","DEPLOYED",filled,""]);

  const allCover = [...coverRows,...stageRows];
  const wsCover = XLSX.utils.aoa_to_sheet(allCover);
  wsCover["!cols"] = [{wch:3},{wch:30},{wch:28},{wch:3},{wch:18},{wch:22},{wch:3}];
  wsCover["!merges"] = [
    {s:{r:1,c:1},e:{r:1,c:5}},
    {s:{r:2,c:1},e:{r:2,c:5}},
    {s:{r:3,c:1},e:{r:3,c:5}},
    {s:{r:5,c:1},e:{r:5,c:5}},
    {s:{r:13,c:1},e:{r:13,c:5}},
  ];
  XLSX.utils.book_append_sheet(wb, wsCover, "Summary");

  // ── Sheet 2: Full Candidate Status ──
  const headers = [
    "S.No","Full Name","Father Name","CNIC","Phone","Trade / Position","Exp. (Yrs)",
    "Passport No.","Passport Expiry","Current Stage",
    "Offer Letter","Contract Signed",
    "Trade Test","Trade Test Date",
    "Medical (GAMCA)","Medical Date",
    "BEOE / Protector","Electronic No. (Muqeem)",
    "Visa Auth. Date","Visa No.","Visa Issue Date",
    "PP Submission Status","PP Submission Date","Dispatch Date","Received by Embassy",
    "Visa Stamping Date","Flight Date",
    "Objection","Remarks"
  ];

  const rows = list.map((c,i)=>[
    i+1, c.name, c.fatherName, c.cnic, c.phone, c.trade, c.experience,
    c.passport, c.passportExpiry ? fmtDate(c.passportExpiry) : "",
    STAGE_MAP[c.stage]?.label||c.stage,
    c.offerLetter, c.contract,
    c.tradeTestStatus, c.tradeTestDate ? fmtDate(c.tradeTestDate) : "",
    c.medicalStatus, c.medicalDate ? fmtDate(c.medicalDate) : "",
    c.beoeStatus, c.electronicNo,
    c.visaAuthDate ? fmtDate(c.visaAuthDate) : "", c.visaNo, c.visaIssueDate ? fmtDate(c.visaIssueDate) : "",
    c.ppSubStatus, c.ppSubDate ? fmtDate(c.ppSubDate) : "", c.ppDispatchDate ? fmtDate(c.ppDispatchDate) : "", c.ppReceivedDate ? fmtDate(c.ppReceivedDate) : "",
    c.stampingDate ? fmtDate(c.stampingDate) : "", c.flightDate ? fmtDate(c.flightDate) : "",
    c.objection, c.remarks
  ]);

  // Title rows above table
  const titleRows = [
    [`STATUS REPORT — ${job.client.toUpperCase()} | ${job.ref} | ${job.position} | Date: ${today()}`],
    [],
  ];

  const wsData = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);

  // Column widths
  wsData["!cols"] = [
    {wch:5},{wch:22},{wch:20},{wch:18},{wch:16},{wch:18},{wch:6},
    {wch:13},{wch:14},{wch:22},
    {wch:11},{wch:14},
    {wch:11},{wch:14},
    {wch:14},{wch:13},
    {wch:16},{wch:22},
    {wch:14},{wch:13},{wch:14},
    {wch:20},{wch:16},{wch:14},{wch:20},
    {wch:16},{wch:13},
    {wch:22},{wch:28}
  ];

  // Merge title row across all columns
  wsData["!merges"] = [{s:{r:0,c:0},e:{r:0,c:28}}];

  XLSX.utils.book_append_sheet(wb, wsData, "Candidate Status");

  // ── Sheet 3: Compact client-ready view ──
  const clientHeaders = [
    "S.No","Name","Trade","Passport No.","Stage","Medical","Visa No.","Flight Date","Status / Remarks"
  ];
  const clientRows = list.map((c,i)=>[
    i+1, c.name, c.trade, c.passport,
    STAGE_MAP[c.stage]?.label||c.stage,
    c.medicalStatus||(c.medicalDate?"Done":"—"),
    c.visaNo||"—",
    c.flightDate?fmtDate(c.flightDate):"—",
    c.objection?`⚠ ${c.objection}`:c.remarks||"In process"
  ]);
  const wsClient = XLSX.utils.aoa_to_sheet([
    [`CLIENT UPDATE — ${job.client} | ${job.position} | Ref: ${job.ref} | ${today()}`],
    [`Riverside Enterprises Recruitment Consultants, Lahore | Vacancies: ${job.vacancies} | Deployed: ${filled}`],
    [],
    clientHeaders,
    ...clientRows
  ]);
  wsClient["!cols"] = [{wch:5},{wch:22},{wch:16},{wch:14},{wch:22},{wch:10},{wch:13},{wch:13},{wch:30}];
  wsClient["!merges"] = [{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];
  XLSX.utils.book_append_sheet(wb, wsClient, "Client Update");

  XLSX.writeFile(wb, `Riverside_${job.client.replace(/\s+/g,"_")}_${job.ref}_${today().replace(/\//g,"-")}.xlsx`);
}

// ─── WHATSAPP ────────────────────────────────────────────────────────────────
function buildWA(cands, jobs, jobId) {
  const job = jobs.find(j=>j.id===jobId);
  if (!job) return "";
  const list = cands.filter(c=>c.jobId===jobId);
  const deployed = list.filter(c=>c.stage==="deployed").length;
  const inProcess = list.filter(c=>!["deployed","rejected"].includes(c.stage)).length;
  const lines = STAGES.map(s=>{ const n=list.filter(c=>c.stage===s.id).length; return n>0?`  ▸ ${s.label}: *${n}*`:null; }).filter(Boolean).join("\n");
  return `🏢 *RIVERSIDE ENTERPRISES*\n_Overseas Recruitment Consultants, Lahore_\n\n📋 *Status Update — ${job.client}*\n━━━━━━━━━━━━━━━━━━━\n*Order Ref:* ${job.ref}\n*Position:* ${job.position}\n*Country:* ${job.country}, ${job.city}\n*Total Vacancies:* ${job.vacancies}\n\n*Pipeline Breakdown:*\n${lines}\n\n✅ *Deployed:* ${deployed} of ${job.vacancies}\n🔄 *In Process:* ${inProcess}\n\n📅 *Date:* ${today()}\n━━━━━━━━━━━━━━━━━━━\n_Riverside Enterprises Recruitment Consultants_\n_Lahore, Pakistan_`;
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const StagePill = ({ stageId, small }) => {
  const s = STAGE_MAP[stageId];
  if (!s) return <span style={{color:"#9CA3AF",fontSize:12}}>—</span>;
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      background:`${s.color}18`,color:s.color,
      padding:small?"2px 8px":"4px 10px",borderRadius:20,
      fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap",
      border:`1px solid ${s.color}30`
    }}>
      <span style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0}}/>
      {s.label}
    </span>
  );
};

const Dot = ({val}) => {
  const c = val==="Yes"?"#10B981":val==="No"?"#EF4444":val==="Pending"?"#F59E0B":val==="Pass"?"#10B981":val==="Fail"?"#EF4444":"#D1D5DB";
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
    <span style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
    {val||"—"}
  </span>;
};

const StatCard = ({label,value,sub,accent}) => (
  <div style={{background:"#fff",borderRadius:12,padding:"18px 20px",border:"1px solid #E5E7EB",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,bottom:0,width:4,background:accent||"#6366F1",borderRadius:"12px 0 0 12px"}}/>
    <div style={{fontSize:12,color:"#6B7280",marginBottom:6,fontWeight:500,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
    <div style={{fontSize:28,fontWeight:700,color:"#111827",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:5}}>{sub}</div>}
  </div>
);

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage]         = useState("dashboard");
  const [cands,setCands]       = useState(DEMO_CANDS);
  const [jobs,setJobs]         = useState(DEMO_JOBS);
  const [log,setLog]           = useState([
    {msg:"Waqar Hussain deployed — Nestle Waters KSA",time:"10/06/2025"},
    {msg:"Tariq Mehmood — Visa Stamping stage",time:"08/06/2025"},
    {msg:"Job order SA-2025-003 created — Denys Arabia",time:"05/06/2025"},
  ]);
  const [modal,setModal]       = useState(null);
  const [editId,setEditId]     = useState(null);
  const [cf,setCf]             = useState(EMPTY_C);
  const [jf,setJf]             = useState(EMPTY_J);
  const [search,setSearch]     = useState("");
  const [stageFil,setStageFil] = useState("");
  const [jobFil,setJobFil]     = useState("");
  const [detailId,setDetailId] = useState(null);
  const [dtab,setDtab]         = useState("overview");
  const [rptJob,setRptJob]     = useState("");
  const [waText,setWaText]     = useState("");
  const [copied,setCopied]     = useState(false);

  const addLog = (msg) => setLog(l=>[{msg,time:today()},...l].slice(0,60));

  const saveCand = () => {
    if(!cf.name.trim()){alert("Full name is required");return;}
    if(editId){
      setCands(cs=>cs.map(c=>c.id===editId?{...c,...cf}:c));
      addLog(`Updated: ${cf.name}`);
    } else {
      setCands(cs=>[...cs,{...cf,id:uid(),addedDate:today()}]);
      addLog(`Added: ${cf.name} — ${cf.trade}`);
    }
    setModal(null);setEditId(null);setCf(EMPTY_C);
  };

  const saveJob = () => {
    if(!jf.ref.trim()||!jf.client.trim()){alert("Reference and client required");return;}
    setJobs(js=>[...js,{...jf,id:uid(),vacancies:Number(jf.vacancies)||1}]);
    addLog(`New order: ${jf.ref} — ${jf.client}`);
    setModal(null);setJf(EMPTY_J);
  };

  const openEdit = (c) => { setEditId(c.id);setCf({...EMPTY_C,...c});setModal("cand"); };
  const delCand  = (id) => { if(!window.confirm("Delete this candidate?"))return; const c=cands.find(x=>x.id===id); setCands(cs=>cs.filter(x=>x.id!==id)); addLog(`Deleted: ${c?.name}`); if(detailId===id)setDetailId(null); };
  const delJob   = (id) => { if(!window.confirm("Delete this job order?"))return; const j=jobs.find(x=>x.id===id); setJobs(js=>js.filter(x=>x.id!==id)); addLog(`Deleted job: ${j?.ref}`); };
  const moveStage= (cid,sid) => { setCands(cs=>cs.map(c=>c.id===cid?{...c,stage:sid}:c)); const c=cands.find(x=>x.id===cid); addLog(`${c?.name} → ${STAGE_MAP[sid]?.label}`); };

  const dc = detailId ? cands.find(c=>c.id===detailId) : null;
  const djob = dc ? jobs.find(j=>j.id===dc.jobId) : null;

  const visibleCands = cands.filter(c=>{
    const q=search.toLowerCase();
    return (!q||c.name.toLowerCase().includes(q)||(c.trade||"").toLowerCase().includes(q)||(c.passport||"").toLowerCase().includes(q))
        && (!stageFil||c.stage===stageFil)
        && (!jobFil||c.jobId===jobFil);
  });

  const totalDeployed = cands.filter(c=>c.stage==="deployed").length;
  const totalActive   = cands.filter(c=>!["deployed","rejected"].includes(c.stage)).length;
  const expiring      = cands.filter(c=>c.passportExpiry&&(new Date(c.passportExpiry)-new Date())/86400000<90);

  // ── STYLE TOKENS ──
  const inp = {padding:"8px 11px",border:"1px solid #E5E7EB",borderRadius:8,fontSize:13,width:"100%",color:"#111827",background:"#fff",fontFamily:"inherit",outline:"none"};
  const btn = (extra={}) => ({background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:"7px 15px",cursor:"pointer",fontSize:13,color:"#374151",fontFamily:"inherit",...extra});
  const pri = btn({background:"#6366F1",border:"1px solid #6366F1",color:"#fff"});
  const card = {background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"};
  const th = {padding:"10px 14px",fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #F3F4F6",textAlign:"left",whiteSpace:"nowrap",background:"#F9FAFB"};
  const td = {padding:"11px 14px",fontSize:13,color:"#374151",borderBottom:"1px solid #F9FAFB",verticalAlign:"middle"};
  const nav = (p) => ({display:"flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,color:page===p?"#6366F1":"#6B7280",background:page===p?"#EEF2FF":"none",border:"none",fontFamily:"inherit",width:"100%",textAlign:"left"});

  const NavItem = ({p,icon,label}) => (
    <button style={nav(p)} onClick={()=>setPage(p)}>
      <span style={{fontSize:16}}>{icon}</span>{label}
    </button>
  );

  const FR = ({label,children,span}) => (
    <div style={{marginBottom:12,gridColumn:span?"1/-1":"auto"}}>
      <div style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
      {children}
    </div>
  );

  const ynp = ["","Yes","No","Pending"];
  const ppStatuses = ["","Not Submitted","Submitted","Dispatched","Received by Embassy","Returned with Visa"];

  const Modal = ({id,title,wide,children}) => modal!==id?null:(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
         onClick={e=>e.target===e.currentTarget&&setModal(null)}>
      <div style={{background:"#fff",borderRadius:16,width:wide||560,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 25px 50px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:"1px solid #F3F4F6",position:"sticky",top:0,background:"#fff",zIndex:1}}>
          <span style={{fontSize:15,fontWeight:700,color:"#111827"}}>{title}</span>
          <button style={btn({padding:"4px 10px"})} onClick={()=>setModal(null)}>✕</button>
        </div>
        <div style={{padding:"20px 22px"}}>{children}</div>
      </div>
    </div>
  );

  // ── SIDEBAR + LAYOUT ──
  return (
    <div style={{display:"flex",minHeight:600,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#F9FAFB",fontSize:14,color:"#111827"}}>

      {/* SIDEBAR */}
      <div style={{width:220,background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:700,flexShrink:0}}>R</div>
            <div>
              <div style={{fontWeight:700,fontSize:13,lineHeight:1.2}}>Riverside ATS</div>
              <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Overseas Recruitment</div>
            </div>
          </div>
        </div>
        <div style={{padding:"0 10px",flex:1}}>
          <div style={{fontSize:10,fontWeight:600,color:"#D1D5DB",padding:"8px 4px 4px",textTransform:"uppercase",letterSpacing:.8}}>Main</div>
          <NavItem p="dashboard" icon="⬛" label="Dashboard"/>
          <NavItem p="candidates" icon="👥" label="Candidates"/>
          <NavItem p="pipeline" icon="📊" label="Pipeline"/>
          <NavItem p="jobs" icon="📋" label="Job Orders"/>
          <div style={{fontSize:10,fontWeight:600,color:"#D1D5DB",padding:"12px 4px 4px",textTransform:"uppercase",letterSpacing:.8}}>Reports</div>
          <NavItem p="reports" icon="📄" label="Status Reports"/>
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid #F3F4F6"}}>
          <div style={{fontSize:11,color:"#9CA3AF"}}>Logged in</div>
          <div style={{fontSize:13,fontWeight:600,color:"#374151"}}>Admin</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflow:"auto"}}>

        {/* HEADER */}
        <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:16}}>
              {page==="dashboard"&&"Dashboard"}
              {page==="candidates"&&"Candidates"}
              {page==="pipeline"&&"Pipeline"}
              {page==="jobs"&&"Job Orders"}
              {page==="reports"&&"Status Reports"}
            </div>
            <div style={{fontSize:12,color:"#9CA3AF",marginTop:1}}>{today()}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {page==="candidates"&&<button style={pri} onClick={()=>{setEditId(null);setCf(EMPTY_C);setModal("cand");}}>+ Add Candidate</button>}
            {page==="jobs"&&<button style={pri} onClick={()=>{setJf(EMPTY_J);setModal("job");}}>+ New Job Order</button>}
          </div>
        </div>

        <div style={{padding:24}}>

          {/* ══ DASHBOARD ══ */}
          {page==="dashboard"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
                <StatCard label="Total Candidates" value={cands.length} sub="All records" accent="#6366F1"/>
                <StatCard label="Active in Pipeline" value={totalActive} sub="In process" accent="#F59E0B"/>
                <StatCard label="Deployed" value={totalDeployed} sub="Successfully placed" accent="#10B981"/>
                <StatCard label="Open Job Orders" value={jobs.filter(j=>j.status==="Open").length} sub="Active demands" accent="#3B82F6"/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                {/* Job order cards */}
                <div style={card}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",fontWeight:600,fontSize:13}}>Active Job Orders</div>
                  <div style={{padding:"0 0 8px"}}>
                    {jobs.filter(j=>j.status==="Open").map(j=>{
                      const jcands=cands.filter(c=>c.jobId===j.id);
                      const dep=jcands.filter(c=>c.stage==="deployed").length;
                      const pct=j.vacancies?Math.min(100,Math.round(dep/j.vacancies*100)):0;
                      return <div key={j.id} style={{padding:"12px 18px",borderBottom:"1px solid #F9FAFB"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{j.client}</div>
                            <div style={{fontSize:12,color:"#6B7280"}}>{j.ref} · {j.position} · {j.country}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontWeight:700,color:"#10B981",fontSize:14}}>{dep}/{j.vacancies}</div>
                            <div style={{fontSize:11,color:"#9CA3AF"}}>deployed</div>
                          </div>
                        </div>
                        <div style={{height:6,borderRadius:3,background:"#F3F4F6"}}>
                          <div style={{height:6,borderRadius:3,background:"#10B981",width:`${pct}%`,transition:"width .4s"}}/>
                        </div>
                        <div style={{display:"flex",gap:12,marginTop:8,fontSize:11,color:"#6B7280"}}>
                          <span>Total: <b style={{color:"#374151"}}>{jcands.length}</b></span>
                          <span>In process: <b style={{color:"#374151"}}>{jcands.filter(c=>!["deployed","rejected"].includes(c.stage)).length}</b></span>
                        </div>
                      </div>;
                    })}
                  </div>
                </div>
                {/* Activity */}
                <div style={card}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",fontWeight:600,fontSize:13}}>Recent Activity</div>
                  <div style={{padding:"8px 0"}}>
                    {log.slice(0,8).map((a,i)=>(
                      <div key={i} style={{display:"flex",gap:12,padding:"9px 18px",borderBottom:"1px solid #F9FAFB"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#6366F1",marginTop:5,flexShrink:0}}/>
                        <div>
                          <div style={{fontSize:13,color:"#374151"}}>{a.msg}</div>
                          <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Expiry alerts */}
              {expiring.length>0&&(
                <div style={{...card,border:"1px solid #FEE2E2"}}>
                  <div style={{padding:"12px 18px",background:"#FEF2F2",borderBottom:"1px solid #FEE2E2",display:"flex",alignItems:"center",gap:8,fontWeight:600,fontSize:13,color:"#991B1B"}}>
                    ⚠ Passport Expiry Alerts — {expiring.length} candidate{expiring.length>1?"s":""} expiring within 90 days
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:12,padding:16}}>
                    {expiring.map(c=>(
                      <div key={c.id} style={{background:"#FEF2F2",border:"1px solid #FEE2E2",borderRadius:8,padding:"8px 14px",cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                        <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                        <div style={{fontSize:12,color:"#DC2626"}}>Expires: {fmtDate(c.passportExpiry)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ CANDIDATES ══ */}
          {page==="candidates"&&(
            <div>
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <input style={{...inp,maxWidth:280}} placeholder="Search name, trade, passport…" value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={{...inp,width:"auto"}} value={stageFil} onChange={e=>setStageFil(e.target.value)}>
                  <option value="">All stages</option>
                  {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select style={{...inp,width:"auto"}} value={jobFil} onChange={e=>setJobFil(e.target.value)}>
                  <option value="">All job orders</option>
                  {jobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client}</option>)}
                </select>
                <div style={{marginLeft:"auto",fontSize:13,color:"#6B7280",display:"flex",alignItems:"center"}}>
                  {visibleCands.length} candidate{visibleCands.length!==1?"s":""}
                </div>
              </div>
              <div style={card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    {["Name & Trade","Passport","Job Order","Stage","Medical","Visa No.","Flight","Actions"].map(h=><th key={h} style={th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {visibleCands.length?visibleCands.map(c=>{
                      const job=jobs.find(j=>j.id===c.jobId);
                      const isExp=expiring.find(x=>x.id===c.id);
                      return <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                        <td style={td}>
                          <div style={{fontWeight:600,color:"#111827"}}>{c.name}</div>
                          <div style={{fontSize:12,color:"#6B7280"}}>{c.trade} · {c.experience?c.experience+" yrs":""}</div>
                        </td>
                        <td style={td}>
                          <div style={{fontFamily:"monospace",fontSize:12}}>{c.passport||"—"}</div>
                          <div style={{fontSize:11,color:isExp?"#EF4444":"#9CA3AF"}}>{fmtDate(c.passportExpiry)}</div>
                        </td>
                        <td style={td}>
                          <div style={{fontSize:12,fontWeight:500}}>{job?job.ref:"—"}</div>
                          <div style={{fontSize:11,color:"#6B7280"}}>{job?job.client:""}</div>
                        </td>
                        <td style={td}><StagePill stageId={c.stage}/></td>
                        <td style={td}><Dot val={c.medicalStatus}/></td>
                        <td style={{...td,fontFamily:"monospace",fontSize:12}}>{c.visaNo||"—"}</td>
                        <td style={{...td,fontSize:12}}>{c.flightDate?fmtDate(c.flightDate):"—"}</td>
                        <td style={td} onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",gap:6}}>
                            <button style={btn({padding:"4px 10px",fontSize:12})} onClick={()=>openEdit(c)}>✏ Edit</button>
                            <button style={btn({padding:"4px 10px",fontSize:12,color:"#EF4444",borderColor:"#FEE2E2"})} onClick={()=>delCand(c.id)}>✕</button>
                          </div>
                        </td>
                      </tr>;
                    }):<tr><td colSpan={8} style={{textAlign:"center",padding:40,color:"#9CA3AF"}}>No candidates found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ PIPELINE — per job order ══ */}
          {page==="pipeline"&&(
            <div>
              <div style={{marginBottom:16,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <select style={{...inp,width:"auto",minWidth:260}} value={jobFil} onChange={e=>setJobFil(e.target.value)}>
                  <option value="">All job orders (combined view)</option>
                  {jobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client} — {j.position}</option>)}
                </select>
                <div style={{fontSize:12,color:"#6B7280"}}>Select a job order to filter pipeline by client</div>
              </div>
              {/* Per-job breakdown */}
              {(jobFil?jobs.filter(j=>j.id===jobFil):jobs).map(j=>{
                const jcands=cands.filter(c=>c.jobId===j.id);
                if(!jcands.length) return null;
                return <div key={j.id} style={{...card,marginBottom:20}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>{j.client}</span>
                      <span style={{fontSize:12,color:"#6B7280",marginLeft:10}}>{j.ref} · {j.position} · {j.country}</span>
                    </div>
                    <div style={{fontSize:12,color:"#6B7280"}}>{jcands.length} candidate{jcands.length!==1?"s":""} · Vacancies: {j.vacancies}</div>
                  </div>
                  <div style={{overflowX:"auto",padding:"14px 18px"}}>
                    <div style={{display:"flex",gap:10,minWidth:STAGES.filter(s=>jcands.some(c=>c.stage===s.id)).length*160||400}}>
                      {STAGES.filter(s=>jcands.some(c=>c.stage===s.id)).map(s=>{
                        const sc=jcands.filter(c=>c.stage===s.id);
                        return <div key={s.id} style={{minWidth:150,flexShrink:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                            <span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                            <span style={{fontSize:11,fontWeight:600,color:"#374151"}}>{s.label}</span>
                            <span style={{marginLeft:"auto",background:"#F3F4F6",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:600,color:"#374151"}}>{sc.length}</span>
                          </div>
                          {sc.map(c=>(
                            <div key={c.id}
                              style={{background:"#fff",border:`1px solid ${s.color}30`,borderLeft:`3px solid ${s.color}`,borderRadius:8,padding:"9px 11px",marginBottom:7,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}
                              onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                              <div style={{fontWeight:600,fontSize:12,color:"#111827"}}>{c.name}</div>
                              <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{c.trade}</div>
                              {c.passport&&<div style={{fontSize:10,color:"#9CA3AF",marginTop:2,fontFamily:"monospace"}}>{c.passport}</div>}
                            </div>
                          ))}
                        </div>;
                      })}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}

          {/* ══ JOB ORDERS ══ */}
          {page==="jobs"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
                {jobs.map(j=>{
                  const jcands=cands.filter(c=>c.jobId===j.id);
                  const dep=jcands.filter(c=>c.stage==="deployed").length;
                  const pct=j.vacancies?Math.min(100,Math.round(dep/j.vacancies*100)):0;
                  const statusColor=j.status==="Open"?"#10B981":j.status==="Filled"?"#6366F1":"#6B7280";
                  return <div key={j.id} style={{...card,padding:0}}>
                    <div style={{padding:"16px 18px",borderBottom:"1px solid #F3F4F6"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15}}>{j.client}</div>
                          <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{j.ref} · {j.country}, {j.city}</div>
                        </div>
                        <span style={{background:`${statusColor}18`,color:statusColor,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${statusColor}30`}}>{j.status}</span>
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:"#374151"}}>{j.position}</div>
                    </div>
                    <div style={{padding:"12px 18px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                        {[["Vacancies",j.vacancies],["Deployed",dep],["Salary","SAR "+j.salary],["Contact",j.contact||"—"]].map(([k,v])=>(
                          <div key={k}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>{k}</div><div style={{fontSize:13,fontWeight:600}}>{v}</div></div>
                        ))}
                      </div>
                      <div style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6B7280",marginBottom:4}}>
                          <span>Fulfillment progress</span><span>{dep}/{j.vacancies} deployed</span>
                        </div>
                        <div style={{height:6,borderRadius:3,background:"#F3F4F6"}}>
                          <div style={{height:6,borderRadius:3,background:"#10B981",width:`${pct}%`}}/>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        <button style={btn({fontSize:12,flex:1})} onClick={()=>{setJobFil(j.id);setPage("pipeline");}}>View Pipeline</button>
                        <button style={btn({fontSize:12,flex:1,color:"#6366F1",borderColor:"#C7D2FE"})} onClick={()=>{setRptJob(j.id);setPage("reports");}}>Export Report</button>
                        <button style={btn({fontSize:12,color:"#EF4444",borderColor:"#FEE2E2",padding:"7px 10px"})} onClick={()=>delJob(j.id)}>✕</button>
                      </div>
                    </div>
                  </div>;
                })}
              </div>
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {page==="reports"&&(
            <div>
              <div style={{...card,marginBottom:20,padding:"20px 22px"}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Generate Status Report</div>
                <div style={{fontSize:13,color:"#6B7280",marginBottom:16}}>Select a client to export their full candidate status report to Excel or generate a WhatsApp update.</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <select style={{...inp,maxWidth:340}} value={rptJob} onChange={e=>{setRptJob(e.target.value);setWaText("");}}>
                    <option value="">— Select client / job order —</option>
                    {jobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client} ({j.position})</option>)}
                  </select>
                  <button style={{...pri,opacity:rptJob?1:.5,display:"flex",alignItems:"center",gap:6}} disabled={!rptJob}
                          onClick={()=>rptJob&&exportExcel(cands,jobs,rptJob)}>
                    📊 Export to Excel
                  </button>
                  <button style={{...btn({background:"#25D366",color:"#fff",border:"none",display:"flex",alignItems:"center",gap:6}),opacity:rptJob?1:.5}} disabled={!rptJob}
                          onClick={()=>rptJob&&setWaText(buildWA(cands,jobs,rptJob))}>
                    📱 WhatsApp Update
                  </button>
                </div>
              </div>

              {waText&&(
                <div style={{...card,marginBottom:20,padding:"18px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:14}}>WhatsApp Message — Ready to Send</div>
                    <button style={btn({background:copied?"#10B981":"#fff",color:copied?"#fff":"#374151",fontSize:12})}
                            onClick={()=>{navigator.clipboard.writeText(waText);setCopied(true);setTimeout(()=>setCopied(false),2500);}}>
                      {copied?"✓ Copied!":"Copy Message"}
                    </button>
                  </div>
                  <pre style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"14px 16px",fontSize:12,whiteSpace:"pre-wrap",fontFamily:"'Courier New',monospace",color:"#166534",lineHeight:1.7,margin:0}}>{waText}</pre>
                </div>
              )}

              {/* Live preview table */}
              {rptJob&&(
                <div style={card}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",fontWeight:700,fontSize:14}}>
                    Preview — {(jobs.find(j=>j.id===rptJob)||{}).client} Status
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}>
                      <thead><tr>
                        {["#","Name","Trade","Passport","Expiry","Stage","Offer","Contract","Trade Test","Medical","BEOE","Elec. No","Visa No","PP Status","Stamping","Flight","Objection","Remarks"].map(h=><th key={h} style={th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {cands.filter(c=>c.jobId===rptJob).map((c,i)=>(
                          <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                            <td style={{...td,color:"#9CA3AF",fontWeight:500}}>{i+1}</td>
                            <td style={{...td,fontWeight:600}}>{c.name}<div style={{fontSize:11,color:"#9CA3AF"}}>{c.fatherName}</div></td>
                            <td style={{...td,fontSize:12}}>{c.trade}</td>
                            <td style={{...td,fontFamily:"monospace",fontSize:12}}>{c.passport||"—"}</td>
                            <td style={{...td,fontSize:12,color:expiring.find(x=>x.id===c.id)?"#EF4444":"inherit"}}>{fmtDate(c.passportExpiry)}</td>
                            <td style={td}><StagePill stageId={c.stage} small/></td>
                            <td style={td}><Dot val={c.offerLetter}/></td>
                            <td style={td}><Dot val={c.contract}/></td>
                            <td style={td}><Dot val={c.tradeTestStatus}/></td>
                            <td style={td}><Dot val={c.medicalStatus}/></td>
                            <td style={td}><Dot val={c.beoeStatus}/></td>
                            <td style={{...td,fontSize:11}}>{c.electronicNo||"—"}</td>
                            <td style={{...td,fontFamily:"monospace",fontSize:11}}>{c.visaNo||"—"}</td>
                            <td style={{...td,fontSize:11}}>{c.ppSubStatus||"—"}</td>
                            <td style={{...td,fontSize:11}}>{c.stampingDate?fmtDate(c.stampingDate):"—"}</td>
                            <td style={{...td,fontSize:11}}>{c.flightDate?fmtDate(c.flightDate):"—"}</td>
                            <td style={{...td,fontSize:11,color:c.objection?"#EF4444":"#9CA3AF"}}>{c.objection||"—"}</td>
                            <td style={{...td,fontSize:11,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.remarks||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Per-client summary cards when no job selected */}
              {!rptJob&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
                  {jobs.map(j=>{
                    const jc=cands.filter(c=>c.jobId===j.id);
                    const dep=jc.filter(c=>c.stage==="deployed").length;
                    return <div key={j.id} style={{...card,padding:"16px 18px"}}>
                      <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{j.client}</div>
                      <div style={{fontSize:12,color:"#6B7280",marginBottom:12}}>{j.ref} · {j.position}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                        {[["Candidates",jc.length],["Deployed",dep],["In Process",jc.filter(c=>!["deployed","rejected"].includes(c.stage)).length],["Vacancies",j.vacancies]].map(([k,v])=>(
                          <div key={k} style={{background:"#F9FAFB",borderRadius:8,padding:"8px 10px"}}>
                            <div style={{fontSize:11,color:"#9CA3AF"}}>{k}</div>
                            <div style={{fontSize:18,fontWeight:700}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button style={{...pri,flex:1,fontSize:12,padding:"6px 12px"}} onClick={()=>setRptJob(j.id)}>Select & Export</button>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══ DETAIL PANEL ══ */}
      {dc&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
          <div style={{flex:1,background:"rgba(0,0,0,.3)"}} onClick={()=>setDetailId(null)}/>
          <div style={{width:460,background:"#fff",borderLeft:"1px solid #E5E7EB",overflowY:"auto",display:"flex",flexDirection:"column"}}>
            {/* Header */}
            <div style={{padding:"20px 22px",borderBottom:"1px solid #F3F4F6",position:"sticky",top:0,background:"#fff",zIndex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16,flexShrink:0}}>
                    {dc.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:16}}>{dc.name}</div>
                    <div style={{fontSize:12,color:"#6B7280"}}>{dc.trade} · {djob?.client||"Unassigned"}</div>
                    <div style={{marginTop:5}}><StagePill stageId={dc.stage}/></div>
                  </div>
                </div>
                <button style={btn({padding:"5px 11px",fontSize:12})} onClick={()=>setDetailId(null)}>✕ Close</button>
              </div>
              <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
                {["overview","process","documents","stage","notes"].map(t=>(
                  <button key={t} style={{...btn({padding:"5px 12px",fontSize:12}),background:dtab===t?"#EEF2FF":"#fff",color:dtab===t?"#6366F1":"#6B7280",borderColor:dtab===t?"#C7D2FE":"#E5E7EB",fontWeight:dtab===t?600:400}}
                          onClick={()=>setDtab(t)}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{padding:"18px 22px",flex:1}}>

              {dtab==="overview"&&(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                    {[["CNIC",dc.cnic],["Phone",dc.phone],["Father's Name",dc.fatherName],["Experience",dc.experience?dc.experience+" years":"—"],["Added",dc.addedDate||"—"],["Job Order",djob?.ref||"Unassigned"],["Client",djob?.client||"—"],["Country",djob?.country||"—"]].map(([k,v])=>(
                      <div key={k} style={{background:"#F9FAFB",borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2,textTransform:"uppercase",letterSpacing:.4}}>{k}</div>
                        <div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{v||"—"}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"#F9FAFB",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2,textTransform:"uppercase",letterSpacing:.4}}>Passport</div>
                    <div style={{fontSize:13,fontWeight:600,fontFamily:"monospace"}}>{dc.passport||"—"}</div>
                    <div style={{fontSize:12,color:expiring.find(x=>x.id===dc.id)?"#EF4444":"#6B7280",marginTop:2}}>Expiry: {fmtDate(dc.passportExpiry)}</div>
                  </div>
                </div>
              )}

              {dtab==="process"&&(
                <div>
                  {[
                    ["Offer Letter","offerLetter"],
                    ["Contract Signed","contract"],
                    ["Trade Test (Takamol)","tradeTestStatus"],
                    ["Trade Test Date","tradeTestDate",true],
                    ["Medical (GAMCA)","medicalStatus"],
                    ["Medical Date","medicalDate",true],
                    ["BEOE / Protector","beoeStatus"],
                    ["Electronic No. (Muqeem/MOFA)","electronicNo",true],
                    ["Visa Auth. Date","visaAuthDate",true],
                    ["Visa No.","visaNo",true],
                    ["Visa Issue Date","visaIssueDate",true],
                    ["Passport Sub. Status","ppSubStatus",true],
                    ["PP Submission Date","ppSubDate",true],
                    ["Dispatch Date","ppDispatchDate",true],
                    ["Received by Embassy","ppReceivedDate",true],
                    ["Visa Stamping Date","stampingDate",true],
                    ["Flight Date","flightDate",true],
                    ["Objection","objection",true],
                  ].map(([label,key,isText])=>{
                    const v = dc[key];
                    return <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F9FAFB"}}>
                      <span style={{fontSize:12,color:"#6B7280"}}>{label}</span>
                      <span style={{fontSize:12,fontWeight:600,color:key==="objection"&&v?"#EF4444":"#111827"}}>
                        {isText ? (v?fmtDate(v)||v:"—") : <Dot val={v}/>}
                      </span>
                    </div>;
                  })}
                </div>
              )}

              {dtab==="documents"&&(
                <div>
                  {[
                    ["Passport Number",dc.passport,"doc"],
                    ["Passport Expiry",dc.passportExpiry,"doc"],
                    ["CNIC",dc.cnic,"doc"],
                    ["Offer Letter",dc.offerLetter,"status"],
                    ["Contract",dc.contract,"status"],
                    ["Trade Test Certificate",dc.tradeTestStatus,"status"],
                    ["Medical Clearance (GAMCA)",dc.medicalStatus,"status"],
                    ["BEOE / Protector Approval",dc.beoeStatus,"status"],
                    ["Electronic No. (Muqeem)",dc.electronicNo,"doc"],
                    ["Visa Number",dc.visaNo,"doc"],
                    ["Visa Stamping",dc.stampingDate,"doc"],
                    ["Flight Ticket",dc.flightDate,"doc"],
                  ].map(([label,val,type])=>{
                    const ok = type==="status"?(val==="Yes"||val==="Pass"):!!val;
                    const dotColor = ok?"#10B981":"#EF4444";
                    return <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #F9FAFB"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                        <span style={{width:10,height:10,borderRadius:"50%",background:dotColor,flexShrink:0}}/>
                        {label}
                      </div>
                      <span style={{fontSize:12,color:"#374151",fontWeight:500}}>{val||"Missing"}</span>
                    </div>;
                  })}
                </div>
              )}

              {dtab==="stage"&&(
                <div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:14}}>Click any stage to update this candidate's status:</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {STAGES.map(s=>{
                      const active=dc.stage===s.id;
                      return <button key={s.id}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,border:active?`2px solid ${s.color}`:"1px solid #E5E7EB",background:active?`${s.color}10`:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all .15s"}}
                        onClick={()=>moveStage(dc.id,s.id)}>
                        <span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                        <span style={{fontSize:13,fontWeight:active?700:400,color:active?s.color:"#374151"}}>{s.label}</span>
                        {active&&<span style={{marginLeft:"auto",fontSize:11,color:s.color,fontWeight:600}}>CURRENT</span>}
                      </button>;
                    })}
                  </div>
                </div>
              )}

              {dtab==="notes"&&(
                <div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:8}}>Internal notes & remarks</div>
                  <textarea
                    defaultValue={dc.remarks||""}
                    onChange={e=>{const v=e.target.value;setCands(cs=>cs.map(c=>c.id===dc.id?{...c,remarks:v}:c));}}
                    placeholder="Add notes, follow-up actions, objection details…"
                    style={{...inp,minHeight:120,resize:"vertical",marginBottom:10}}
                  />
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:8,marginTop:8}}>Objection (if any)</div>
                  <textarea
                    defaultValue={dc.objection||""}
                    onChange={e=>{const v=e.target.value;setCands(cs=>cs.map(c=>c.id===dc.id?{...c,objection:v}:c));}}
                    placeholder="Describe any objection raised by embassy or client…"
                    style={{...inp,minHeight:70,resize:"vertical",marginBottom:14,borderColor:"#FEE2E2"}}
                  />
                  <button style={pri} onClick={()=>addLog(`Notes updated: ${dc.name}`)}>Save Notes</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CANDIDATE MODAL ══ */}
      <Modal id="cand" title={editId?"Edit Candidate":"Add New Candidate"} wide={640}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FR label="Full Name *"><input style={inp} value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))} placeholder="Muhammad Usman"/></FR>
          <FR label="Father's Name"><input style={inp} value={cf.fatherName} onChange={e=>setCf(f=>({...f,fatherName:e.target.value}))} placeholder="Muhammad Iqbal"/></FR>
          <FR label="CNIC"><input style={inp} value={cf.cnic} onChange={e=>setCf(f=>({...f,cnic:e.target.value}))} placeholder="35202-XXXXXXX-X"/></FR>
          <FR label="Phone"><input style={inp} value={cf.phone} onChange={e=>setCf(f=>({...f,phone:e.target.value}))} placeholder="+92 300 XXXXXXX"/></FR>
          <FR label="Trade / Position *"><input style={inp} value={cf.trade} onChange={e=>setCf(f=>({...f,trade:e.target.value}))} placeholder="Civil Engineer, Driver…"/></FR>
          <FR label="Experience (years)"><input style={inp} type="number" min="0" value={cf.experience} onChange={e=>setCf(f=>({...f,experience:e.target.value}))}/></FR>
          <FR label="Passport No."><input style={inp} value={cf.passport} onChange={e=>setCf(f=>({...f,passport:e.target.value}))} placeholder="AC1234567"/></FR>
          <FR label="Passport Expiry"><input style={inp} type="date" value={cf.passportExpiry} onChange={e=>setCf(f=>({...f,passportExpiry:e.target.value}))}/></FR>
          <FR label="Stage">
            <select style={inp} value={cf.stage} onChange={e=>setCf(f=>({...f,stage:e.target.value}))}>
              {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </FR>
          <FR label="Job Order">
            <select style={inp} value={cf.jobId} onChange={e=>setCf(f=>({...f,jobId:e.target.value}))}>
              <option value="">— Unassigned —</option>
              {jobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client} ({j.position})</option>)}
            </select>
          </FR>

          <FR label="Offer Letter"><select style={inp} value={cf.offerLetter} onChange={e=>setCf(f=>({...f,offerLetter:e.target.value}))}>{ynp.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Contract Signed"><select style={inp} value={cf.contract} onChange={e=>setCf(f=>({...f,contract:e.target.value}))}>{ynp.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Trade Test (Takamol)"><select style={inp} value={cf.tradeTestStatus} onChange={e=>setCf(f=>({...f,tradeTestStatus:e.target.value}))}>{["","Pass","Fail","Pending"].map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Trade Test Date"><input style={inp} type="date" value={cf.tradeTestDate} onChange={e=>setCf(f=>({...f,tradeTestDate:e.target.value}))}/></FR>
          <FR label="Medical (GAMCA)"><select style={inp} value={cf.medicalStatus} onChange={e=>setCf(f=>({...f,medicalStatus:e.target.value}))}>{ynp.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Medical Date"><input style={inp} type="date" value={cf.medicalDate} onChange={e=>setCf(f=>({...f,medicalDate:e.target.value}))}/></FR>
          <FR label="BEOE / Protector"><select style={inp} value={cf.beoeStatus} onChange={e=>setCf(f=>({...f,beoeStatus:e.target.value}))}>{ynp.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Electronic No. (Muqeem)"><input style={inp} value={cf.electronicNo} onChange={e=>setCf(f=>({...f,electronicNo:e.target.value}))} placeholder="SA-E-XXXXXX"/></FR>
          <FR label="Visa Auth. Date"><input style={inp} type="date" value={cf.visaAuthDate} onChange={e=>setCf(f=>({...f,visaAuthDate:e.target.value}))}/></FR>
          <FR label="Visa No."><input style={inp} value={cf.visaNo} onChange={e=>setCf(f=>({...f,visaNo:e.target.value}))} placeholder="SA1234567"/></FR>
          <FR label="Visa Issue Date"><input style={inp} type="date" value={cf.visaIssueDate} onChange={e=>setCf(f=>({...f,visaIssueDate:e.target.value}))}/></FR>
          <FR label="Passport Submission">
            <select style={inp} value={cf.ppSubStatus} onChange={e=>setCf(f=>({...f,ppSubStatus:e.target.value}))}>
              {ppStatuses.map(v=><option key={v}>{v}</option>)}
            </select>
          </FR>
          <FR label="PP Submission Date"><input style={inp} type="date" value={cf.ppSubDate} onChange={e=>setCf(f=>({...f,ppSubDate:e.target.value}))}/></FR>
          <FR label="Dispatch Date"><input style={inp} type="date" value={cf.ppDispatchDate} onChange={e=>setCf(f=>({...f,ppDispatchDate:e.target.value}))}/></FR>
          <FR label="Received by Embassy"><input style={inp} type="date" value={cf.ppReceivedDate} onChange={e=>setCf(f=>({...f,ppReceivedDate:e.target.value}))}/></FR>
          <FR label="Visa Stamping Date"><input style={inp} type="date" value={cf.stampingDate} onChange={e=>setCf(f=>({...f,stampingDate:e.target.value}))}/></FR>
          <FR label="Flight Date"><input style={inp} type="date" value={cf.flightDate} onChange={e=>setCf(f=>({...f,flightDate:e.target.value}))}/></FR>
          <FR label="Objection (if any)" span><input style={{...inp,borderColor:"#FEE2E2"}} value={cf.objection} onChange={e=>setCf(f=>({...f,objection:e.target.value}))} placeholder="Any objection raised by embassy or client…"/></FR>
          <FR label="Remarks" span><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={cf.remarks} onChange={e=>setCf(f=>({...f,remarks:e.target.value}))} placeholder="Internal notes…"/></FR>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid #F3F4F6"}}>
          <button style={btn()} onClick={()=>setModal(null)}>Cancel</button>
          <button style={pri} onClick={saveCand}>{editId?"Save Changes":"Add Candidate"}</button>
        </div>
      </Modal>

      {/* ══ JOB MODAL ══ */}
      <Modal id="job" title="New Job Order">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FR label="Order Reference *"><input style={inp} value={jf.ref} onChange={e=>setJf(f=>({...f,ref:e.target.value}))} placeholder="SA-2025-004"/></FR>
          <FR label="Client / Company *"><input style={inp} value={jf.client} onChange={e=>setJf(f=>({...f,client:e.target.value}))} placeholder="Al Rajhi Contracting"/></FR>
          <FR label="Country">
            <select style={inp} value={jf.country} onChange={e=>setJf(f=>({...f,country:e.target.value}))}>
              {["Saudi Arabia","UAE","Qatar","Kuwait","Bahrain","Oman","Other"].map(c=><option key={c}>{c}</option>)}
            </select>
          </FR>
          <FR label="City"><input style={inp} value={jf.city} onChange={e=>setJf(f=>({...f,city:e.target.value}))} placeholder="Riyadh, Jeddah…"/></FR>
          <FR label="Position / Trade *"><input style={inp} value={jf.position} onChange={e=>setJf(f=>({...f,position:e.target.value}))} placeholder="Civil Engineer…"/></FR>
          <FR label="Vacancies"><input style={inp} type="number" min="1" value={jf.vacancies} onChange={e=>setJf(f=>({...f,vacancies:e.target.value}))}/></FR>
          <FR label="Salary (SAR)"><input style={inp} value={jf.salary} onChange={e=>setJf(f=>({...f,salary:e.target.value}))} placeholder="2,500"/></FR>
          <FR label="Deadline"><input style={inp} type="date" value={jf.deadline} onChange={e=>setJf(f=>({...f,deadline:e.target.value}))}/></FR>
          <FR label="Status">
            <select style={inp} value={jf.status} onChange={e=>setJf(f=>({...f,status:e.target.value}))}>
              <option>Open</option><option>Filled</option><option>Closed</option>
            </select>
          </FR>
          <FR label="Contact Person"><input style={inp} value={jf.contact} onChange={e=>setJf(f=>({...f,contact:e.target.value}))} placeholder="HR Manager name"/></FR>
          <FR label="Notes" span><textarea style={{...inp,minHeight:55,resize:"vertical"}} value={jf.notes} onChange={e=>setJf(f=>({...f,notes:e.target.value}))} placeholder="Any requirements or notes…"/></FR>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid #F3F4F6"}}>
          <button style={btn()} onClick={()=>setModal(null)}>Cancel</button>
          <button style={pri} onClick={saveJob}>Create Job Order</button>
        </div>
      </Modal>

    </div>
  );
}
