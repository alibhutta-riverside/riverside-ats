import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { STAGES, STAGE_MAP, COUNTRIES, YNP, PP_STATUSES, TRADE_TEST_OPTS, EMPTY_CAND, EMPTY_JOB, uid, fmtDate, today, todayISO, daysUntil, sanitizeForDb } from "./lib/constants";
import Login from "./components/Login";
import ApplyForm from "./components/ApplyForm";
import Databank from "./components/Databank";
import CrmDashboard from "./crm/CrmDashboard";
import ClientList from "./crm/ClientList";
import ClientDetail from "./crm/ClientDetail";
import CampaignManager from "./crm/CampaignManager";
import CrmReports from "./crm/CrmReports";
import * as XLSX from "xlsx";

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
function exportExcel(cands, jobs, jobId, positions=[]) {
  const job = jobs.find(j=>j.id===jobId);
  if (!job) return;
  const list = cands.filter(c=>c.job_id===jobId);
  const wb = XLSX.utils.book_new();
  const filled = list.filter(c=>c.stage==="deployed").length;
  const allPos = [
    { position_name: job.position, required_count: job.vacancies, salary: job.salary },
    ...positions.filter(p=>p.job_id===jobId)
  ];
  const totalVac = allPos.reduce((s,p)=>s+(Number(p.required_count)||0),0);
  const positionLabel = allPos.map(p=>p.position_name).join(", ");

  const coverRows = [
    ["","","","","","",""],
    ["","RIVERSIDE ENTERPRISES RECRUITMENT CONSULTANTS","","","","",""],
    ["","Overseas Employment Promoters | Govt. of Pakistan Licensed","","","","",""],
    ["","","","","","",""],
    ["","CLIENT STATUS REPORT","","","","",""],
    ["","","","","","",""],
    ["","Client:",job.client,"","Country:",job.country,""],
    ["","Order Ref:",job.ref,"","City:",job.city,""],
    ["","Report Date:",today(),"","Deadline:",fmtDate(job.deadline),""],
    ["","","","","","",""],
    ["","JOB POSITIONS","","","","",""],
    ["","Position","Vacancies","","Salary (SAR)","",""],
    ...allPos.map(p=>["",p.position_name,p.required_count,"",p.salary||"—","",""]),
    ["","","","","","",""],
    ["","PIPELINE SUMMARY","","","","",""],
    ["","","","","","",""],
  ];
  let stageRows = [["","Stage","Candidates","","","",""]];
  STAGES.forEach(s=>{ const n=list.filter(c=>c.stage===s.id).length; if(n>0) stageRows.push(["",s.label,n,"","","",""]); });
  stageRows.push(["","","","","","",""]);
  stageRows.push(["","TOTAL CANDIDATES",list.length,"","DEPLOYED",filled,""]);
  const wsCover = XLSX.utils.aoa_to_sheet([...coverRows,...stageRows]);
  wsCover["!cols"] = [{wch:3},{wch:30},{wch:28},{wch:3},{wch:18},{wch:22},{wch:3}];
  wsCover["!merges"] = [{s:{r:1,c:1},e:{r:1,c:5}},{s:{r:2,c:1},e:{r:2,c:5}},{s:{r:4,c:1},e:{r:4,c:5}},{s:{r:10,c:1},e:{r:10,c:5}},{s:{r:13+allPos.length,c:1},e:{r:13+allPos.length,c:5}}];
  XLSX.utils.book_append_sheet(wb, wsCover, "Summary");

  const headers = ["S.No","Full Name","Father Name","CNIC","Phone","Trade","Exp.","Passport","Pass. Expiry","Stage","Salary (SAR)",
    "Offer Letter","Contract","Electronic No.","Visa Auth Date","Visa No.","Visa Issue Date",
    "Medical","Medical Date","Medical Expiry","Trade Test","Trade Test Date",
    "PP Status","PP Sub Date","Dispatch Date","Recv. Embassy","Stamping Date","BEOE","BEOE Perm #","BEOE Reg #","BEOE Fee","Flight Date","Objection","Remarks"];
  const rows = list.map((c,i)=>[
    i+1,c.name,c.father_name,c.cnic,c.phone,c.trade,c.experience,c.passport,c.passport_expiry?fmtDate(c.passport_expiry):"",STAGE_MAP[c.stage]?.label||c.stage,c.offered_salary||job.salary||"—",
    c.offer_letter,c.contract,c.electronic_no,c.visa_auth_date?fmtDate(c.visa_auth_date):"",c.visa_no,c.visa_issue_date?fmtDate(c.visa_issue_date):"",
    c.medical_status,c.medical_date?fmtDate(c.medical_date):"",c.medical_expiry?fmtDate(c.medical_expiry):"",c.trade_test_status,c.trade_test_date?fmtDate(c.trade_test_date):"",
    c.pp_sub_status,c.pp_sub_date?fmtDate(c.pp_sub_date):"",c.pp_dispatch_date?fmtDate(c.pp_dispatch_date):"",c.pp_received_date?fmtDate(c.pp_received_date):"",c.stamping_date?fmtDate(c.stamping_date):"",c.beoe_status,c.beoe_permission_no||"",c.beoe_registration_no||"",c.beoe_fee_paid||"",c.flight_date?fmtDate(c.flight_date):"",c.objection,c.remarks
  ]);
  const wsData = XLSX.utils.aoa_to_sheet([[`STATUS REPORT — ${job.client.toUpperCase()} | ${job.ref} | ${positionLabel} | ${today()}`],[],headers,...rows]);
  wsData["!cols"] = headers.map(()=>({wch:16}));
  wsData["!merges"] = [{s:{r:0,c:0},e:{r:0,c:34}}];
  XLSX.utils.book_append_sheet(wb, wsData, "Candidate Status");

  const clientHeaders = ["S.No","Name","Trade","Passport No.","Stage","Salary (SAR)","Medical","Visa No.","Flight Date","Status / Remarks"];
  const clientRows = list.map((c,i)=>[i+1,c.name,c.trade,c.passport,STAGE_MAP[c.stage]?.label||c.stage,c.offered_salary||job.salary||"—",c.medical_status||(c.medical_date?"Done":"—"),c.visa_no||"—",c.flight_date?fmtDate(c.flight_date):"—",c.objection?`⚠ ${c.objection}`:c.remarks||"In process"]);
  const wsClient = XLSX.utils.aoa_to_sheet([[`CLIENT UPDATE — ${job.client} | ${positionLabel} | Ref: ${job.ref} | ${today()}`],[`Riverside Enterprises Recruitment Consultants, Lahore | Total Vacancies: ${totalVac} | Deployed: ${filled}`],[],clientHeaders,...clientRows]);
  wsClient["!cols"] = [{wch:5},{wch:22},{wch:16},{wch:14},{wch:22},{wch:14},{wch:10},{wch:13},{wch:13},{wch:30}];
  wsClient["!merges"] = [{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}}];
  XLSX.utils.book_append_sheet(wb, wsClient, "Client Update");

  XLSX.writeFile(wb, `Riverside_${job.client.replace(/\s+/g,"_")}_${job.ref}_${today().replace(/\//g,"-")}.xlsx`);
}

function buildWA(cands, jobs, jobId, positions=[]) {
  const job = jobs.find(j=>j.id===jobId);
  if (!job) return "";
  const list = cands.filter(c=>c.job_id===jobId);
  const deployed = list.filter(c=>c.stage==="deployed").length;
  const inProcess = list.filter(c=>!["deployed","rejected"].includes(c.stage)).length;
  const lines = STAGES.map(s=>{ const n=list.filter(c=>c.stage===s.id).length; return n>0?`  ▸ ${s.label}: *${n}*`:null; }).filter(Boolean).join("\n");
  const allPos = [
    { position_name: job.position, required_count: job.vacancies, salary: job.salary },
    ...positions.filter(p=>p.job_id===jobId)
  ];
  const totalVac = allPos.reduce((s,p)=>s+(Number(p.required_count)||0),0);
  const positionLines = allPos.map(p=>`  ▸ ${p.position_name} — ${p.required_count} vacancies${p.salary?` @ SAR ${p.salary}`:""}`).join("\n");

  // Salary breakdown: group candidates by their actual offered salary (falls back to job default)
  const salaryGroups = {};
  list.forEach(c => { const sal = c.offered_salary || job.salary || "Not set"; salaryGroups[sal] = (salaryGroups[sal]||0) + 1; });
  const salaryLines = Object.entries(salaryGroups).map(([sal,n]) => `  ▸ SAR ${sal}: *${n}* candidate${n>1?"s":""}`).join("\n");

  return `🏢 *RIVERSIDE ENTERPRISES*\n_Overseas Recruitment Consultants, Lahore_\n\n📋 *Status Update — ${job.client}*\n━━━━━━━━━━━━━━━━━━━\n*Order Ref:* ${job.ref}\n*Country:* ${job.country}, ${job.city}\n\n*Job Positions:*\n${positionLines}\n*Total Vacancies:* ${totalVac}\n\n*Pipeline Breakdown:*\n${lines}\n\n*Salary Breakdown (Actual Offered):*\n${salaryLines}\n\n✅ *Deployed:* ${deployed} of ${totalVac}\n🔄 *In Process:* ${inProcess}\n\n📅 *Date:* ${today()}\n━━━━━━━━━━━━━━━━━━━\n_Riverside Enterprises Recruitment Consultants_`;
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const StagePill = ({ stageId, small }) => {
  const s = STAGE_MAP[stageId];
  if (!s) return <span style={{color:"#9CA3AF",fontSize:12}}>—</span>;
  return <span style={{ display:"inline-flex",alignItems:"center",gap:5,background:`${s.color}18`,color:s.color,padding:small?"2px 8px":"4px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap",border:`1px solid ${s.color}30` }}>
    <span style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0}}/>{s.label}
  </span>;
};

const Dot = ({val}) => {
  const c = val==="Yes"?"#10B981":val==="No"?"#EF4444":val==="Pending"?"#F59E0B":val==="Pass"?"#10B981":val==="Fail"?"#EF4444":"#D1D5DB";
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}><span style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>{val||"—"}</span>;
};

const StatCard = ({label,value,sub,accent}) => (
  <div style={{background:"#fff",borderRadius:12,padding:"16px 18px",border:"1px solid #E5E7EB",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,bottom:0,width:4,background:accent||"#6366F1"}}/>
    <div style={{fontSize:11,color:"#6B7280",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
    <div style={{fontSize:26,fontWeight:700,color:"#111827",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"#9CA3AF",marginTop:5}}>{sub}</div>}
  </div>
);

const Avatar = ({ url, name, size=36 }) => url
  ? <img src={url} alt={name} style={{ width:size, height:size, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
  : <div style={{ width:size, height:size, borderRadius:8, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size/3, fontWeight:600, color:"#9CA3AF", flexShrink:0 }}>{(name||"?").charAt(0).toUpperCase()}</div>;

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function FR({label,children,span}) {
  return (
    <div style={{marginBottom:12,gridColumn:span?"1/-1":"auto"}}>
      <div style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
      {children}
    </div>
  );
}

export default function App() {
  // Public job application page — no login required.
  // Triggered either by a dedicated subdomain (careers./jobs./apply.riverside.com.pk)
  // or by ?apply=1 for testing on the default Vercel URL.
  const isPublicApplyPage = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("apply") ||
    /^(careers|jobs|apply)\./i.test(window.location.hostname)
  );
  if (isPublicApplyPage) {
    return <ApplyForm />;
  }
  return <AppInner />;
}

function AppInner() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [page, setPage] = useState(null);
  const [showPos, setShowPos] = useState(null);
  const [cands, setCands] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [positions, setPositions] = useState([]);
  const [log, setLog] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [cf, setCf] = useState(EMPTY_CAND);
  const [jf, setJf] = useState(EMPTY_JOB);
  const [editJobId, setEditJobId] = useState(null);
  const [tempPositions, setTempPositions] = useState([]);
  const [newPos, setNewPos] = useState({position_name:"",required_count:1,salary:""});
  const [search, setSearch] = useState("");
  const [stageFil, setStageFil] = useState("");
  const [jobFil, setJobFil] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [crmView, setCrmView] = useState("dashboard"); // 'dashboard' | 'clients' | 'campaigns'
  const [crmClientId, setCrmClientId] = useState(null);
  const [dtab, setDtab] = useState("overview");
  const [rptJob, setRptJob] = useState("");
  const [waText, setWaText] = useState("");
  const [copied, setCopied] = useState(false);
  const [storageUsage, setStorageUsage] = useState(null);

  // ── AUTH ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingAuth(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  const fetchAll = useCallback(async () => {
    const { data: jobsData } = await supabase.from("job_orders").select("*").order("created_at",{ascending:false});
    const { data: candsData } = await supabase.from("candidates").select("*").order("added_date",{ascending:false});
    const { data: logData } = await supabase.from("activity_log").select("*").order("created_at",{ascending:false}).limit(60);
    const { data: posData } = await supabase.from("job_positions").select("*");
    setJobs(jobsData||[]);
    setCands(candsData||[]);
    setPositions(posData||[]);
    setLog((logData||[]).map(l=>({ msg:l.message, time:new Date(l.created_at).toLocaleDateString("en-GB") })));
  }, []);

  useEffect(() => { if (session) fetchAll(); }, [session, fetchAll]);

  useEffect(() => {
    if (profile?.role === "admin") {
      supabase.rpc('get_storage_usage').then(({ data }) => setStorageUsage(data || []));
    }
  }, [profile]);

  const addLog = async (msg) => {
    setLog(l=>[{msg,time:today()},...l].slice(0,60));
    if (profile) await supabase.from("activity_log").insert([{ message:msg, created_by:profile.id }]);
  };

  const Modal = useCallback(({id,title,wide,children}) => modal!==id?null:(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
         onClick={e=>e.target===e.currentTarget&&setModal(null)}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:wide||560,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 25px 50px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:"1px solid #F3F4F6",position:"sticky",top:0,background:"#fff",zIndex:1}}>
          <span style={{fontSize:15,fontWeight:700,color:"#111827"}}>{title}</span>
          <button style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:13,color:"#374151",fontFamily:"inherit"}} onClick={()=>setModal(null)}>✕</button>
        </div>
        <div style={{padding:"20px 22px"}}>{children}</div>
      </div>
    </div>
  ), [modal]);

  if (loadingAuth) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"sans-serif",color:"#6B7280"}}>Loading…</div>;
  if (!session) return <Login />;
  if (!profile) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"sans-serif",color:"#6B7280"}}>Setting up your account…</div>;

  if (page === null) {
    setPage(profile.ats_access ? "dashboard" : (profile.crm_access ? "crm" : "dashboard"));
    return null;
  }

  // ── ROLE-BASED VISIBILITY ──
  const visibleJobs = profile.role === "manager" && profile.assigned_clients?.length
    ? jobs.filter(j => profile.assigned_clients.includes(j.client))
    : jobs;
  const visibleJobIds = new Set(visibleJobs.map(j=>j.id));
  const visibleCandsAll = profile.role === "manager" && profile.assigned_clients?.length
    ? cands.filter(c => !c.job_id || visibleJobIds.has(c.job_id))
    : cands;

  // ── CRUD ──
  const saveCand = async () => {
    if (!cf.name.trim()) { alert("Full name is required"); return; }
    if (!cf.cnic.trim()) { alert("CNIC/ID is required"); return; }
    
    if (!editId) {
      const { data: existing } = await supabase.from("candidates").select("id").eq("cnic", cf.cnic).limit(1);
      if (existing && existing.length > 0) {
        alert(`⚠️ Candidate with CNIC "${cf.cnic}" already exists. Cannot add duplicate.`);
        return;
      }
    }
    
    const payload = sanitizeForDb({ ...cf });
    delete payload.id;
    if (editId) {
      const { error } = await supabase.from("candidates").update(payload).eq("id", editId);
      if (error) { alert(error.message); return; }
      addLog(`Updated: ${cf.name}`);
    } else {
      const { error } = await supabase.from("candidates").insert([{ ...payload, created_by: profile.id }]);
      if (error) { alert(error.message); return; }
      addLog(`Added: ${cf.name} — ${cf.trade}`);
    }
    setModal(null); setEditId(null); setCf(EMPTY_CAND);
    fetchAll();
  };

  const saveJob = async () => {
    if (!jf.ref.trim() || !jf.client.trim()) { alert("Reference and client required"); return; }
    const payload = sanitizeForDb({ ...jf, vacancies:Number(jf.vacancies)||1 });

    if (editJobId) {
      const { error } = await supabase.from("job_orders").update(payload).eq("id", editJobId);
      if (error) { alert(error.message); return; }

      if (tempPositions && tempPositions.length > 0) {
        const posPayload = tempPositions.map(p => ({
          job_id: editJobId,
          position_name: p.position_name,
          required_count: Number(p.required_count) || 1,
          salary: p.salary || ""
        }));
        await supabase.from("job_positions").insert(posPayload);
      }

      addLog(`Updated order: ${jf.ref} — ${jf.client}${tempPositions && tempPositions.length > 0 ? ` (+${tempPositions.length} new positions)` : ""}`);
      setModal(null);
      setJf(EMPTY_JOB);
      setTempPositions([]);
      setNewPos({position_name:"",required_count:1,salary:""});
      setEditJobId(null);
      fetchAll();
      return;
    }

    const { data: jobData, error } = await supabase.from("job_orders").insert([{ ...payload, created_by: profile.id }]).select();
    if (error) { alert(error.message); return; }
    
    // Save positions if any were added
    if (jobData && jobData[0] && tempPositions && tempPositions.length > 0) {
      const jobId = jobData[0].id;
      const posPayload = tempPositions.map(p => ({
        job_id: jobId,
        position_name: p.position_name,
        required_count: Number(p.required_count) || 1,
        salary: p.salary || ""
      }));
      await supabase.from("job_positions").insert(posPayload);
    }
    
    addLog(`New order: ${jf.ref} — ${jf.client}${tempPositions && tempPositions.length > 0 ? ` (${tempPositions.length} positions)` : ""}`);
    setModal(null); 
    setJf(EMPTY_JOB); 
    setTempPositions([]);
    setNewPos({position_name:"",required_count:1,salary:""});
    fetchAll();
  };

  const openEditJob = (j) => {
    setJf({
      ref: j.ref || "", client: j.client || "", country: j.country || "", city: j.city || "",
      position: j.position || "", vacancies: j.vacancies || 1, salary: j.salary || "",
      deadline: j.deadline || "", status: j.status || "Open", contact: j.contact || "", notes: j.notes || "",
    });
    setEditJobId(j.id);
    setTempPositions([]);
    setModal("job");
  };

  const openEdit = (c) => { setEditId(c.id); setCf({...EMPTY_CAND,...c}); setModal("cand"); };
  const delCand = async (id) => {
    if (!window.confirm("Delete this candidate?")) return;
    const c = cands.find(x=>x.id===id);
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    addLog(`Deleted: ${c?.name}`);
    if (detailId===id) setDetailId(null);
    fetchAll();
  };
  const delJob = async (id) => {
    if (!window.confirm("Delete this job order?")) return;
    const j = jobs.find(x=>x.id===id);
    const { error } = await supabase.from("job_orders").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    addLog(`Deleted job: ${j?.ref}`);
    fetchAll();
  };

  const delPos = async (posId) => {
    if (!window.confirm("Delete this position?")) return;
    const { error } = await supabase.from("job_positions").delete().eq("id", posId);
    if (error) { alert(error.message); return; }
    addLog("Position deleted");
    fetchAll();
  };
  
  const moveStage = async (cid, sid) => {
    const { error } = await supabase.from("candidates").update({ stage: sid }).eq("id", cid);
    if (error) { alert(error.message); return; }
    const c = cands.find(x=>x.id===cid);
    addLog(`${c?.name} → ${STAGE_MAP[sid]?.label}`);
    fetchAll();
  };

  const dc = detailId ? cands.find(c=>c.id===detailId) : null;
  const djob = dc ? jobs.find(j=>j.id===dc.job_id) : null;

  const assignedCands = visibleCandsAll.filter(c=>c.job_id); // those in actual job pipelines

  const visibleCands = assignedCands.filter(c=>{
    const q=search.toLowerCase();
    return (!q||c.name.toLowerCase().includes(q)||(c.trade||"").toLowerCase().includes(q)||(c.passport||"").toLowerCase().includes(q))
        && (!stageFil||c.stage===stageFil)
        && (!jobFil||c.job_id===jobFil);
  });

  const totalDeployed = assignedCands.filter(c=>c.stage==="deployed").length;
  const totalActive = assignedCands.filter(c=>!["deployed","rejected"].includes(c.stage)).length;
  const passportExpiring = visibleCandsAll.filter(c=>{ const d=daysUntil(c.passport_expiry); return d!==null && d<90; });
  const medicalExpiring = visibleCandsAll.filter(c=>{ const d=daysUntil(c.medical_expiry); return d!==null && d<30 && d>=0; });

  // ── STYLE TOKENS ──
  const inp = {padding:"8px 11px",border:"1px solid #E5E7EB",borderRadius:8,fontSize:13,width:"100%",color:"#111827",background:"#fff",fontFamily:"inherit",outline:"none"};
  const btn = (extra={}) => ({background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:"7px 15px",cursor:"pointer",fontSize:13,color:"#374151",fontFamily:"inherit",...extra});
  const pri = btn({background:"#6366F1",border:"1px solid #6366F1",color:"#fff"});
  const card = {background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"};
  const th = {padding:"10px 14px",fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #F3F4F6",textAlign:"left",whiteSpace:"nowrap",background:"#F9FAFB"};
  const td = {padding:"11px 14px",fontSize:13,color:"#374151",borderBottom:"1px solid #F9FAFB",verticalAlign:"middle"};
  const S = { card, th, td };
  const nav = (p) => ({display:"flex",alignItems:"center",gap:9,padding:"9px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,color:page===p?"#6366F1":"#6B7280",background:page===p?"#EEF2FF":"none",border:"none",fontFamily:"inherit",width:"100%",textAlign:"left"});

  const NavItem = ({p,icon,label}) => (
    <button style={nav(p)} onClick={()=>{setPage(p);setMobileNavOpen(false);}}><span style={{fontSize:16}}>{icon}</span>{label}</button>
  );

  const canDelete = profile.role === "admin";
  const canManage = profile.role === "admin" || profile.role === "manager";

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#F9FAFB",fontSize:14,color:"#111827"}}>

      {/* MOBILE HEADER */}
      <div className="mobile-only" style={{display:"flex",position:"fixed",top:0,left:0,right:0,height:56,background:"#fff",borderBottom:"1px solid #E5E7EB",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:150}}>
        <button onClick={()=>setMobileNavOpen(!mobileNavOpen)} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer" }}>☰</button>
        <div style={{ fontWeight:700, fontSize:15 }}>Riverside ATS</div>
        <div style={{ width:30 }}/>
      </div>

      {/* MOBILE BACKDROP */}
      {mobileNavOpen && <div onClick={()=>setMobileNavOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:99}}/>}

      {/* SIDEBAR */}
      <div className="sidebar" data-open={mobileNavOpen} style={{width:220,background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",zIndex:100,
        ...(mobileNavOpen ? {position:"fixed",left:0,top:56,height:"calc(100vh - 56px)",display:"flex"} : {})}}>
        <div style={{padding:"20px 16px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:700,flexShrink:0}}>R</div>
            <div>
              <div style={{fontWeight:700,fontSize:13,lineHeight:1.2}}>Riverside ATS</div>
              <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Overseas Recruitment</div>
            </div>
          </div>
        </div>
        <div style={{padding:"0 10px",flex:1}}>
          {profile.ats_access && <>
            <div style={{fontSize:10,fontWeight:600,color:"#D1D5DB",padding:"8px 4px 4px",textTransform:"uppercase",letterSpacing:.8}}>Main</div>
            <NavItem p="dashboard" icon="⬛" label="Dashboard"/>
            <NavItem p="databank" icon="📁" label="CV Databank"/>
            <NavItem p="candidates" icon="👥" label="In-Process Candidates"/>
            <NavItem p="pipeline" icon="📊" label="Pipeline"/>
            <NavItem p="jobs" icon="📋" label="Job Orders"/>
            <div style={{fontSize:10,fontWeight:600,color:"#D1D5DB",padding:"12px 4px 4px",textTransform:"uppercase",letterSpacing:.8}}>Reports</div>
            <NavItem p="reports" icon="📄" label="Status Reports"/>
          </>}
          {profile.crm_access && <>
            <div style={{fontSize:10,fontWeight:600,color:"#D1D5DB",padding:"12px 4px 4px",textTransform:"uppercase",letterSpacing:.8}}>Sales</div>
            <NavItem p="crm" icon="📞" label="Client CRM"/>
          </>}
          {profile.role==="admin" && <NavItem p="staff" icon="🔑" label="Staff Access"/>}
          {profile.role==="admin" && <NavItem p="auditlog" icon="🛡️" label="Audit Log"/>}
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid #F3F4F6"}}>
          <div style={{fontSize:11,color:"#9CA3AF"}}>Logged in as</div>
          <div style={{fontSize:13,fontWeight:600,color:"#374151"}}>{profile.full_name}</div>
          <div style={{fontSize:11,color:"#6366F1",fontWeight:600,textTransform:"capitalize"}}>{profile.role}</div>
          <button style={{...btn({fontSize:11,padding:"5px 10px",marginTop:8,width:"100%"})}} onClick={()=>supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>
      {mobileNavOpen && <div onClick={()=>setMobileNavOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",zIndex:90}}/>}

      {/* MAIN */}
      <div style={{flex:1,overflow:"auto",minWidth:0}} className="main-content">
        <div className="desktop-header" style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:16}}>
              {page==="dashboard"&&"Dashboard"}{page==="databank"&&"CV Databank"}{page==="candidates"&&"In-Process Candidates"}
              {page==="pipeline"&&"Pipeline"}{page==="jobs"&&"Job Orders"}{page==="reports"&&"Status Reports"}{page==="crm"&&"Client CRM"}{page==="staff"&&"Staff Access Management"}{page==="auditlog"&&"Audit Log"}
            </div>
            <div style={{fontSize:12,color:"#9CA3AF",marginTop:1}}>{today()}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {page==="candidates"&&<button style={pri} onClick={()=>{setEditId(null);setCf(EMPTY_CAND);setModal("cand");}}>+ Add Candidate</button>}
            {page==="jobs"&&canManage&&<button style={pri} onClick={()=>{setJf(EMPTY_JOB);setEditJobId(null);setModal("job");}}>+ New Job Order</button>}
          </div>
        </div>

        <div style={{padding:24}} className="content-padding">

          {/* ══ DASHBOARD ══ */}
          {page==="dashboard"&&(
            <div>
              {profile.role==="admin" && storageUsage && (() => {
                const totalBytes = storageUsage.reduce((s,b)=>s+Number(b.total_bytes||0),0);
                const limitBytes = 1024*1024*1024; // 1GB free tier
                const pct = Math.min(100, Math.round((totalBytes/limitBytes)*100));
                const usedMB = (totalBytes/1024/1024).toFixed(1);
                const totalFiles = storageUsage.reduce((s,b)=>s+Number(b.file_count||0),0);
                const warn = pct >= 80;
                return (
                  <div style={{...card, marginBottom:20, padding:"16px 18px", border: warn ? "1px solid #FEE2E2" : "1px solid #E5E7EB"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{fontWeight:700,fontSize:13}}>📦 File Storage (CVs &amp; Photos)</div>
                      <div style={{fontSize:12,color:warn?"#DC2626":"#6B7280",fontWeight:600}}>{usedMB} MB / 1024 MB ({pct}%) · {totalFiles} files</div>
                    </div>
                    <div style={{height:8,borderRadius:4,background:"#F3F4F6"}}>
                      <div style={{height:8,borderRadius:4,background:warn?"#EF4444":"#10B981",width:`${pct}%`,transition:"width 0.3s"}}/>
                    </div>
                    {warn && <div style={{fontSize:11,color:"#DC2626",marginTop:6}}>⚠ Approaching free tier limit. Consider upgrading to Supabase Pro (100GB) to avoid upload failures.</div>}
                  </div>
                );
              })()}
              <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
                <StatCard label="CV Databank" value={visibleCandsAll.filter(c=>!c.job_id).length} sub="Available, unassigned" accent="#9CA3AF"/>
                <StatCard label="In Pipeline" value={totalActive} sub="Active processing" accent="#F59E0B"/>
                <StatCard label="Deployed" value={totalDeployed} sub="Successfully placed" accent="#10B981"/>
                <StatCard label="Open Job Orders" value={visibleJobs.filter(j=>j.status==="Open").length} sub="Active demands" accent="#3B82F6"/>
              </div>

              {(passportExpiring.length>0 || medicalExpiring.length>0) && (
                <div style={{...card,border:"1px solid #FEE2E2",marginBottom:16}}>
                  <div style={{padding:"12px 18px",background:"#FEF2F2",borderBottom:"1px solid #FEE2E2",fontWeight:700,fontSize:13,color:"#991B1B"}}>⚠ Expiry Alerts</div>
                  <div style={{padding:16}}>
                    {passportExpiring.length>0 && <>
                      <div style={{fontSize:12,fontWeight:600,color:"#991B1B",marginBottom:8}}>Passport expiring within 90 days ({passportExpiring.length})</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:medicalExpiring.length?16:0}}>
                        {passportExpiring.map(c=>(
                          <div key={c.id} style={{background:"#FEF2F2",border:"1px solid #FEE2E2",borderRadius:8,padding:"8px 14px",cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                            <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                            <div style={{fontSize:12,color:"#DC2626"}}>Expires: {fmtDate(c.passport_expiry)}</div>
                          </div>
                        ))}
                      </div>
                    </>}
                    {medicalExpiring.length>0 && <>
                      <div style={{fontSize:12,fontWeight:600,color:"#92400E",marginBottom:8}}>Medical clearance expiring within 30 days ({medicalExpiring.length})</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                        {medicalExpiring.map(c=>(
                          <div key={c.id} style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 14px",cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("process");}}>
                            <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                            <div style={{fontSize:12,color:"#B45309"}}>Medical expires: {fmtDate(c.medical_expiry)}</div>
                          </div>
                        ))}
                      </div>
                    </>}
                  </div>
                </div>
              )}

              <div className="dash-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <div style={card}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",fontWeight:600,fontSize:13}}>Active Job Orders</div>
                  <div>
                    {visibleJobs.filter(j=>j.status==="Open").map(j=>{
                      const jcands=assignedCands.filter(c=>c.job_id===j.id);
                      const dep=jcands.filter(c=>c.stage==="deployed").length;
                      const pct=j.vacancies?Math.min(100,Math.round(dep/j.vacancies*100)):0;
                      return <div key={j.id} style={{padding:"12px 18px",borderBottom:"1px solid #F9FAFB"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <div><div style={{fontWeight:600,fontSize:13}}>{j.client}</div><div style={{fontSize:12,color:"#6B7280"}}>{j.ref} · {j.position}</div></div>
                          <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:"#10B981",fontSize:14}}>{dep}/{j.vacancies}</div><div style={{fontSize:11,color:"#9CA3AF"}}>deployed</div></div>
                        </div>
                        <div style={{height:6,borderRadius:3,background:"#F3F4F6"}}><div style={{height:6,borderRadius:3,background:"#10B981",width:`${pct}%`}}/></div>
                      </div>;
                    })}
                  </div>
                </div>
                <div style={card}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",fontWeight:600,fontSize:13}}>Recent Activity</div>
                  <div>{log.slice(0,8).map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:12,padding:"9px 18px",borderBottom:"1px solid #F9FAFB"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#6366F1",marginTop:5,flexShrink:0}}/>
                      <div><div style={{fontSize:13,color:"#374151"}}>{a.msg}</div><div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{a.time}</div></div>
                    </div>
                  ))}</div>
                </div>
              </div>
            </div>
          )}

          {/* ══ CV DATABANK ══ */}
          {page==="databank"&&(
            <Databank candidates={visibleCandsAll} jobs={visibleJobs} profile={profile} onRefresh={fetchAll} addLog={addLog} S={S} inp={inp} btn={btn} pri={pri} FR={FR} />
          )}

          {/* ══ IN-PROCESS CANDIDATES ══ */}
          {page==="candidates"&&(
            <div>
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <input style={{...inp,maxWidth:280}} placeholder="Search name, trade, passport…" value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={{...inp,width:"auto"}} value={stageFil} onChange={e=>setStageFil(e.target.value)}>
                  <option value="">All stages</option>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select style={{...inp,width:"auto"}} value={jobFil} onChange={e=>setJobFil(e.target.value)}>
                  <option value="">All job orders</option>{visibleJobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client}</option>)}
                </select>
              </div>
              <div style={card}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>{["","Name & Trade","Passport","Job Order","Salary","Stage","Medical","Visa No.","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {visibleCands.length?visibleCands.map(c=>{
                        const job=jobs.find(j=>j.id===c.job_id);
                        const isExp=passportExpiring.find(x=>x.id===c.id);
                        return <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                          <td style={td}><Avatar url={c.photo_url} name={c.name}/></td>
                          <td style={td}><div style={{fontWeight:600,color:"#111827"}}>{c.name}</div><div style={{fontSize:12,color:"#6B7280"}}>{c.trade}</div>{c.status_note && <div style={{fontSize:10,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:6,padding:"2px 5px",marginTop:3,display:"inline-block"}}>⚠ {c.status_note}</div>}</td>
                          <td style={td}><div style={{fontFamily:"monospace",fontSize:12}}>{c.passport||"—"}</div><div style={{fontSize:11,color:isExp?"#EF4444":"#9CA3AF"}}>{fmtDate(c.passport_expiry)}</div></td>
                          <td style={td}><div style={{fontSize:12,fontWeight:500}}>{job?job.ref:"—"}</div><div style={{fontSize:11,color:"#6B7280"}}>{job?job.client:""}</div></td>
                          <td style={td}>
                            <div style={{fontSize:12,fontWeight:600,color:c.offered_salary?"#059669":"#6B7280"}}>{c.offered_salary || job?.salary || "—"}</div>
                            {c.offered_salary && job?.salary && c.offered_salary!==job.salary && <div style={{fontSize:10,color:"#9CA3AF"}}>job default: {job.salary}</div>}
                          </td>
                          <td style={td}><StagePill stageId={c.stage}/></td>
                          <td style={td}><Dot val={c.medical_status}/></td>
                          <td style={{...td,fontFamily:"monospace",fontSize:12}}>{c.visa_no||"—"}</td>
                          <td style={td} onClick={e=>e.stopPropagation()}>
                            <div style={{display:"flex",gap:6}}>
                              <button style={btn({padding:"4px 10px",fontSize:12})} onClick={()=>openEdit(c)}>Edit</button>
                              {canDelete && <button style={btn({padding:"4px 10px",fontSize:12,color:"#EF4444",borderColor:"#FEE2E2"})} onClick={()=>delCand(c.id)}>✕</button>}
                            </div>
                          </td>
                        </tr>;
                      }):<tr><td colSpan={9} style={{textAlign:"center",padding:40,color:"#9CA3AF"}}>No candidates assigned to job orders yet. Assign from CV Databank.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ PIPELINE ══ */}
          {page==="pipeline"&&(
            <div>
              <div style={{marginBottom:16}}>
                <select style={{...inp,width:"auto",minWidth:260}} value={jobFil} onChange={e=>setJobFil(e.target.value)}>
                  <option value="">All job orders (combined view)</option>{visibleJobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client} — {j.position}</option>)}
                </select>
              </div>
              {(jobFil?visibleJobs.filter(j=>j.id===jobFil):visibleJobs).map(j=>{
                const jcands=assignedCands.filter(c=>c.job_id===j.id);
                if(!jcands.length) return null;
                return <div key={j.id} style={{...card,marginBottom:20}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div><span style={{fontWeight:700,fontSize:14}}>{j.client}</span><span style={{fontSize:12,color:"#6B7280",marginLeft:10}}>{j.ref} · {j.position}</span></div>
                    <div style={{fontSize:12,color:"#6B7280"}}>{jcands.length} candidate(s) · Vacancies: {j.vacancies}</div>
                  </div>
                  <div style={{overflowX:"auto",padding:"14px 18px"}}>
                    <div style={{display:"flex",gap:10,minWidth:STAGES.filter(s=>jcands.some(c=>c.stage===s.id)).length*160||400}}>
                      {STAGES.filter(s=>jcands.some(c=>c.stage===s.id)).map(s=>{
                        const sc=jcands.filter(c=>c.stage===s.id);
                        return <div key={s.id} style={{minWidth:150,flexShrink:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                            <span style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                            <span style={{fontSize:11,fontWeight:600,color:"#374151"}}>{s.label}</span>
                            <span style={{marginLeft:"auto",background:"#F3F4F6",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:600}}>{sc.length}</span>
                          </div>
                          {sc.map(c=>(
                            <div key={c.id} style={{background:"#fff",border:`1px solid ${s.color}30`,borderLeft:`3px solid ${s.color}`,borderRadius:8,padding:"9px 11px",marginBottom:7,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}
                              onClick={()=>{setDetailId(c.id);setDtab("overview");}}>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <Avatar url={c.photo_url} name={c.name} size={28}/>
                                <div><div style={{fontWeight:600,fontSize:12,color:"#111827"}}>{c.name}</div><div style={{fontSize:11,color:"#6B7280"}}>{c.trade}</div></div>
                              </div>
                              {c.status_note && <div style={{fontSize:10,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:6,padding:"3px 6px",marginTop:6}}>⚠ {c.status_note}</div>}
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
            <div className="job-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
              {visibleJobs.map(j=>{
                const jcands=assignedCands.filter(c=>c.job_id===j.id);
                const dep=jcands.filter(c=>c.stage==="deployed").length;
                const totalVac=(Number(j.vacancies)||0) + positions.filter(p=>p.job_id===j.id).reduce((sum,p)=>sum+(Number(p.required_count)||0),0);
                const pct=totalVac?Math.min(100,Math.round(dep/totalVac*100)):0;
                const statusColor=j.status==="Open"?"#10B981":j.status==="Filled"?"#6366F1":"#6B7280";
                const allPositions=[
                  { position_name:j.position, required_count:j.vacancies, salary:j.salary },
                  ...positions.filter(p=>p.job_id===j.id)
                ];
                return <div key={j.id} style={{...card,padding:0}}>
                  <div style={{padding:"16px 18px",borderBottom:"1px solid #F3F4F6"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div><div style={{fontWeight:700,fontSize:15}}>{j.client}</div><div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{j.ref} · {j.country}</div></div>
                      <span style={{background:`${statusColor}18`,color:statusColor,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{j.status}</span>
                    </div>
                  </div>
                  <div style={{padding:"12px 18px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                      {[["Total Vacancies",totalVac],["Deployed",dep],["Contact",j.contact||"—"],["Status",j.status]].map(([k,v])=>(
                        <div key={k}><div style={{fontSize:11,color:"#9CA3AF"}}>{k}</div><div style={{fontSize:13,fontWeight:600}}>{v}</div></div>
                      ))}
                    </div>

                    {/* ALL JOB POSITIONS - UNIFIED LIST, NO DISTINCTION */}
                    <div style={{marginBottom:12,background:"#F9FAFB",borderRadius:8,padding:"10px 12px",border:"1px solid #E5E7EB"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:6,textTransform:"uppercase"}}>Job Positions:</div>
                      {allPositions.map((p,idx)=>(
                        <div key={idx} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,borderTop:idx>0?"1px solid #E5E7EB":"none",paddingTop:idx>0?6:4}}>
                          <span style={{fontWeight:600,color:"#374151"}}>{p.position_name}</span>
                          <span style={{color:"#6B7280"}}>Vacancies: {p.required_count} | SAR {p.salary||"—"}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{height:6,borderRadius:3,background:"#F3F4F6",marginBottom:10}}><div style={{height:6,borderRadius:3,background:"#10B981",width:`${pct}%`}}/></div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button style={btn({fontSize:12,flex:1})} onClick={()=>{setJobFil(j.id);setPage("pipeline");}}>View Pipeline</button>
                      <button style={btn({fontSize:12,flex:1,color:"#6366F1",borderColor:"#C7D2FE"})} onClick={()=>{setRptJob(j.id);setPage("reports");}}>Export Report</button>
                      {canManage && <button style={btn({fontSize:12,color:"#10B981",borderColor:"#A7F3D0",padding:"7px 10px"})} onClick={()=>openEditJob(j)}>Edit</button>}
                      {canManage && <button style={btn({fontSize:12,color:"#EF4444",borderColor:"#FEE2E2",padding:"7px 10px"})} onClick={()=>delJob(j.id)}>✕</button>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {page==="reports"&&(
            <div>
              <div style={{...card,marginBottom:20,padding:"20px 22px"}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Generate Status Report</div>
                <div style={{fontSize:13,color:"#6B7280",marginBottom:16}}>Select a client to export their full candidate status report.</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <select style={{...inp,maxWidth:340}} value={rptJob} onChange={e=>{setRptJob(e.target.value);setWaText("");}}>
                    <option value="">— Select client / job order —</option>
                    {visibleJobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client} ({j.position})</option>)}
                  </select>
                  <button style={{...pri,opacity:rptJob?1:.5}} disabled={!rptJob} onClick={()=>rptJob&&exportExcel(cands,jobs,rptJob,positions)}>📊 Export to Excel</button>
                  <button style={{...btn({background:"#25D366",color:"#fff",border:"none"}),opacity:rptJob?1:.5}} disabled={!rptJob} onClick={()=>rptJob&&setWaText(buildWA(cands,jobs,rptJob,positions))}>📱 WhatsApp Update</button>
                </div>
              </div>
              {waText&&(
                <div style={{...card,marginBottom:20,padding:"18px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:14}}>WhatsApp Message</div>
                    <button style={btn({background:copied?"#10B981":"#fff",color:copied?"#fff":"#374151",fontSize:12})} onClick={()=>{navigator.clipboard.writeText(waText);setCopied(true);setTimeout(()=>setCopied(false),2500);}}>{copied?"✓ Copied!":"Copy"}</button>
                  </div>
                  <pre style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"14px 16px",fontSize:12,whiteSpace:"pre-wrap",fontFamily:"monospace",color:"#166534",lineHeight:1.7,margin:0}}>{waText}</pre>
                </div>
              )}
              {!rptJob&&(
                <div className="job-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                  {visibleJobs.map(j=>{
                    const jc=assignedCands.filter(c=>c.job_id===j.id);
                    const dep=jc.filter(c=>c.stage==="deployed").length;
                    return <div key={j.id} style={{...card,padding:"16px 18px"}}>
                      <div style={{fontWeight:700,fontSize:14}}>{j.client}</div>
                      <div style={{fontSize:12,color:"#6B7280",marginBottom:12}}>{j.ref}</div>
                      <button style={{...pri,width:"100%",fontSize:12}} onClick={()=>setRptJob(j.id)}>Select & Export</button>
                    </div>;
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ CRM ══ */}
          {page==="crm"&&profile.crm_access&&(
            <div>
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                {["dashboard","clients","campaigns","reports"].filter(v=>profile.crm_sections?.includes(v)).map(v=>(
                  <button key={v} style={btn({background:crmView===v?"#6366F1":"#fff",color:crmView===v?"#fff":"#374151"})}
                    onClick={()=>{setCrmView(v);setCrmClientId(null);}}>
                    {v.charAt(0).toUpperCase()+v.slice(1)}
                  </button>
                ))}
              </div>
              {crmView==="dashboard" && profile.crm_sections?.includes("dashboard") && <CrmDashboard currentUser={profile} />}
              {crmView==="clients" && profile.crm_sections?.includes("clients") && !crmClientId && <ClientList onSelectClient={setCrmClientId} currentUser={profile} />}
              {crmView==="clients" && profile.crm_sections?.includes("clients") && crmClientId && (
                <ClientDetail clientId={crmClientId} currentUser={profile} onBack={()=>setCrmClientId(null)} />
              )}
              {crmView==="campaigns" && profile.crm_sections?.includes("campaigns") && <CampaignManager currentUser={profile} />}
              {crmView==="reports" && profile.crm_sections?.includes("reports") && <CrmReports />}
            </div>
          )}

          {/* ══ STAFF ACCESS (admin only) ══ */}
          {page==="staff"&&profile.role==="admin"&&(
            <StaffManagement S={S} inp={inp} btn={btn} pri={pri} jobs={jobs} />
          )}

          {/* ══ AUDIT LOG (admin only) ══ */}
          {page==="auditlog"&&profile.role==="admin"&&(
            <AuditLog S={S} inp={inp} btn={btn} />
          )}

        </div>
      </div>

      {/* ══ DETAIL PANEL ══ */}
      {dc&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",background:"rgba(0,0,0,.3)",width:"100vw",height:"100vh"}}>
          <div style={{flex:1,background:"rgba(0,0,0,.3)",display:"none"}} onClick={()=>setDetailId(null)}/>
          <div style={{width:"100%",maxWidth:"460px",marginLeft:"auto",background:"#fff",borderLeft:"1px solid #E5E7EB",overflowY:"auto",maxHeight:"100vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid #F3F4F6",position:"sticky",top:0,background:"#fff",zIndex:1,flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",minWidth:0,flex:1}}>
                  <Avatar url={dc.photo_url} name={dc.name} size={40}/>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dc.name}</div>
                    <div style={{fontSize:12,color:"#6B7280",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dc.trade}</div>
                    <div style={{marginTop:4}}><StagePill stageId={dc.stage}/></div>
                  </div>
                </div>
                <button style={btn({padding:"6px 10px",fontSize:12,flexShrink:0})} onClick={()=>setDetailId(null)}>✕</button>
              </div>
              <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                {["overview","process","documents","stage","notes"].map(t=>(
                  <button key={t} style={{...btn({padding:"5px 10px",fontSize:11}),background:dtab===t?"#EEF2FF":"#fff",color:dtab===t?"#6366F1":"#6B7280",borderColor:dtab===t?"#C7D2FE":"#E5E7EB",fontWeight:dtab===t?600:400,flex:1}} onClick={()=>setDtab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
                ))}
              </div>
            </div>
            <div style={{padding:"14px 16px",flex:1,overflowY:"auto"}}>
              {dtab==="overview"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                  {[["CNIC",dc.cnic],["Phone",dc.phone],["Father's Name",dc.father_name],["Experience",dc.experience?dc.experience+" years":"—"],["Job Order",djob?.ref||"Unassigned"],["Client",djob?.client||"—"],["Offered Salary (SAR)",dc.offered_salary?`${dc.offered_salary} (custom)`:(djob?.salary?`${djob.salary} (job default)`:"—")],["Passport",dc.passport],["Pass. Expiry",fmtDate(dc.passport_expiry)]].map(([k,v])=>(
                    <div key={k} style={{background:"#F9FAFB",borderRadius:8,padding:"9px 11px"}}>
                      <div style={{fontSize:11,color:"#9CA3AF",textTransform:"uppercase",marginBottom:2}}>{k}</div>
                      <div style={{fontSize:12,fontWeight:600,wordBreak:"break-word"}}>{v||"—"}</div>
                    </div>
                  ))}
                  {dc.status_note && (
                    <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"9px 11px",gridColumn:"1/-1"}}>
                      <div style={{fontSize:11,color:"#92400E",textTransform:"uppercase",marginBottom:2,fontWeight:600}}>⚠ Status Note</div>
                      <div style={{fontSize:12,fontWeight:600,color:"#78350F",wordBreak:"break-word"}}>{dc.status_note}</div>
                    </div>
                  )}
                </div>
              )}
              {dtab==="process"&&(
                <div>
                  {[
                    ["Offer Letter","offer_letter"],["Contract Signed","contract"],
                    ["Electronic No. (Muqeem/MOFA)","electronic_no",1],["Visa Auth. Date","visa_auth_date",1],
                    ["Visa No.","visa_no",1],["Visa Issue Date","visa_issue_date",1],
                    ["Medical (GAMCA)","medical_status"],["Medical Date","medical_date",1],["Medical Expiry","medical_expiry",1],
                    ["Trade Test (Takamol)","trade_test_status"],["Trade Test Date","trade_test_date",1],
                    ["Passport Sub. Status","pp_sub_status",1],["PP Submission Date","pp_sub_date",1],
                    ["Dispatch Date","pp_dispatch_date",1],["Received by Embassy","pp_received_date",1],
                    ["Visa Stamping Date","stamping_date",1],["BEOE / Protector","beoe_status"],
                    ["BEOE Permission No.","beoe_permission_no",1],["BEOE Registration No.","beoe_registration_no",1],
                    ["BEOE Fee Paid","beoe_fee_paid",1],["Flight Date","flight_date",1],["Objection","objection",1],
                  ].map(([label,key,isText])=>(
                    <div key={key} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F9FAFB",fontSize:12}}>
                      <span style={{color:"#6B7280",flex:1}}>{label}</span>
                      <span style={{fontWeight:600,color:key==="objection"&&dc[key]?"#EF4444":"#111827",textAlign:"right",flex:1,wordBreak:"break-word"}}>{isText?(dc[key]?fmtDate(dc[key])||dc[key]:"—"):<Dot val={dc[key]}/>}</span>
                    </div>
                  ))}
                </div>
              )}
              {dtab==="documents"&&(
                <div>
                  {[["Passport Number",dc.passport],["Photo",dc.photo_url],["CV File",dc.cv_url],["Offer Letter",dc.offer_letter],["Contract",dc.contract],["Medical Clearance",dc.medical_status],["Visa Number",dc.visa_no],["Stamping",dc.stamping_date]].map(([label,val])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F9FAFB",fontSize:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:val?"#10B981":"#EF4444",flexShrink:0}}/><span>{label}</span></div>
                      {label==="CV File"&&val ? <a href={val} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#6366F1",textDecoration:"none"}}>View</a> : <span style={{fontSize:12,color:"#374151"}}>{val&&label!=="Photo"?val:val?"✓":"✗"}</span>}
                    </div>
                  ))}
                </div>
              )}
              {dtab==="stage"&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {STAGES.map(s=>{
                    const active=dc.stage===s.id;
                    return <button key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:active?`2px solid ${s.color}`:"1px solid #E5E7EB",background:active?`${s.color}10`:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit",fontSize:12}} onClick={()=>moveStage(dc.id,s.id)}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                      <span style={{fontWeight:active?700:400,color:active?s.color:"#374151",flex:1}}>{s.label}</span>
                      {active&&<span style={{fontSize:10,color:s.color,fontWeight:600,flexShrink:0}}>✓</span>}
                    </button>;
                  })}
                </div>
              )}
              {dtab==="notes"&&(
                <div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Remarks</div>
                  <textarea defaultValue={dc.remarks||""} onBlur={async e=>{ await supabase.from("candidates").update({remarks:e.target.value}).eq("id",dc.id); fetchAll(); }} style={{...inp,minHeight:80,resize:"vertical",marginBottom:12,fontSize:12}} />
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Objection</div>
                  <textarea defaultValue={dc.objection||""} onBlur={async e=>{ await supabase.from("candidates").update({objection:e.target.value}).eq("id",dc.id); fetchAll(); }} style={{...inp,minHeight:60,resize:"vertical",borderColor:"#FEE2E2",fontSize:12}} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CANDIDATE MODAL ══ */}
      <Modal id="cand" title={editId?"Edit Candidate":"Add New Candidate"} wide={640}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="modal-grid">
          <FR label="Full Name *"><input key="name" style={inp} value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))} /></FR>
          <FR label="Father's Name"><input key="father_name" style={inp} value={cf.father_name} onChange={e=>setCf(f=>({...f,father_name:e.target.value}))} /></FR>
          <FR label="CNIC *"><input key="cnic" style={inp} value={cf.cnic} onChange={e=>setCf(f=>({...f,cnic:e.target.value}))} /></FR>
          <FR label="Phone"><input key="phone" style={inp} value={cf.phone} onChange={e=>setCf(f=>({...f,phone:e.target.value}))} /></FR>
          <FR label="Trade / Position *"><input key="trade" style={inp} value={cf.trade} onChange={e=>setCf(f=>({...f,trade:e.target.value}))} /></FR>
          <FR label="Passport No."><input key="passport" style={inp} value={cf.passport} onChange={e=>setCf(f=>({...f,passport:e.target.value}))} /></FR>
          <FR label="Passport Expiry"><input key="passport_expiry" style={inp} type="date" value={cf.passport_expiry} onChange={e=>setCf(f=>({...f,passport_expiry:e.target.value}))} /></FR>
          <FR label="Stage"><select key="stage" style={inp} value={cf.stage} onChange={e=>setCf(f=>({...f,stage:e.target.value}))}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></FR>
          <FR label="Status Note (internal — e.g. passport renewal pending)" span>
            <input style={{...inp,borderColor:"#FDE68A"}} value={cf.status_note||""} onChange={e=>setCf(f=>({...f,status_note:e.target.value}))} placeholder="e.g. Passport expired, renewal in process — expected next week" />
          </FR>
          <FR label="Job Order"><select key="job_id" style={inp} value={cf.job_id||""} onChange={e=>setCf(f=>({...f,job_id:e.target.value||null}))}><option value="">— Unassigned —</option>{visibleJobs.map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client}</option>)}</select></FR>
          <FR label="Offered Salary (SAR)">
            <input style={inp} type="number" value={cf.offered_salary||""} onChange={e=>setCf(f=>({...f,offered_salary:e.target.value}))}
              placeholder={(()=>{ const j=visibleJobs.find(j=>j.id===cf.job_id); return j?.salary ? `Default: ${j.salary}` : "e.g. 2000"; })()} />
          </FR>

          <FR label="Offer Letter"><select style={inp} value={cf.offer_letter} onChange={e=>setCf(f=>({...f,offer_letter:e.target.value}))}>{YNP.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Contract Signed"><select style={inp} value={cf.contract} onChange={e=>setCf(f=>({...f,contract:e.target.value}))}>{YNP.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Electronic No. (Muqeem)"><input style={inp} value={cf.electronic_no} onChange={e=>setCf(f=>({...f,electronic_no:e.target.value}))} /></FR>
          <FR label="Visa Auth. Date"><input style={inp} type="date" value={cf.visa_auth_date} onChange={e=>setCf(f=>({...f,visa_auth_date:e.target.value}))} /></FR>
          <FR label="Visa No."><input style={inp} value={cf.visa_no} onChange={e=>setCf(f=>({...f,visa_no:e.target.value}))} /></FR>
          <FR label="Visa Issue Date"><input style={inp} type="date" value={cf.visa_issue_date} onChange={e=>setCf(f=>({...f,visa_issue_date:e.target.value}))} /></FR>
          <FR label="Medical (GAMCA)"><select style={inp} value={cf.medical_status} onChange={e=>setCf(f=>({...f,medical_status:e.target.value}))}>{YNP.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Medical Date"><input style={inp} type="date" value={cf.medical_date} onChange={e=>setCf(f=>({...f,medical_date:e.target.value}))} /></FR>
          <FR label="Medical Expiry"><input style={inp} type="date" value={cf.medical_expiry} onChange={e=>setCf(f=>({...f,medical_expiry:e.target.value}))} /></FR>
          <FR label="Trade Test (Takamol)"><select style={inp} value={cf.trade_test_status} onChange={e=>setCf(f=>({...f,trade_test_status:e.target.value}))}>{TRADE_TEST_OPTS.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="Trade Test Date"><input style={inp} type="date" value={cf.trade_test_date} onChange={e=>setCf(f=>({...f,trade_test_date:e.target.value}))} /></FR>
          <FR label="Passport Submission"><select style={inp} value={cf.pp_sub_status} onChange={e=>setCf(f=>({...f,pp_sub_status:e.target.value}))}>{PP_STATUSES.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="PP Submission Date"><input style={inp} type="date" value={cf.pp_sub_date} onChange={e=>setCf(f=>({...f,pp_sub_date:e.target.value}))} /></FR>
          <FR label="Dispatch Date"><input style={inp} type="date" value={cf.pp_dispatch_date} onChange={e=>setCf(f=>({...f,pp_dispatch_date:e.target.value}))} /></FR>
          <FR label="Received by Embassy"><input style={inp} type="date" value={cf.pp_received_date} onChange={e=>setCf(f=>({...f,pp_received_date:e.target.value}))} /></FR>
          <FR label="Visa Stamping Date"><input style={inp} type="date" value={cf.stamping_date} onChange={e=>setCf(f=>({...f,stamping_date:e.target.value}))} /></FR>
          <FR label="BEOE / Protector"><select style={inp} value={cf.beoe_status} onChange={e=>setCf(f=>({...f,beoe_status:e.target.value}))}>{YNP.map(v=><option key={v}>{v}</option>)}</select></FR>
          <FR label="BEOE Permission No."><input style={inp} value={cf.beoe_permission_no} onChange={e=>setCf(f=>({...f,beoe_permission_no:e.target.value}))} /></FR>
          <FR label="BEOE Registration No."><input style={inp} value={cf.beoe_registration_no} onChange={e=>setCf(f=>({...f,beoe_registration_no:e.target.value}))} /></FR>
          <FR label="BEOE Fee Paid"><input style={inp} value={cf.beoe_fee_paid} onChange={e=>setCf(f=>({...f,beoe_fee_paid:e.target.value}))} placeholder="Yes/No/Pending" /></FR>
          <FR label="Flight Date"><input style={inp} type="date" value={cf.flight_date} onChange={e=>setCf(f=>({...f,flight_date:e.target.value}))} /></FR>
          <FR label="Objection (if any)" span><input style={{...inp,borderColor:"#FEE2E2"}} value={cf.objection} onChange={e=>setCf(f=>({...f,objection:e.target.value}))} /></FR>
          <FR label="Remarks" span><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={cf.remarks} onChange={e=>setCf(f=>({...f,remarks:e.target.value}))} /></FR>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid #F3F4F6"}}>
          <button style={btn()} onClick={()=>setModal(null)}>Cancel</button>
          <button style={pri} onClick={saveCand}>{editId?"Save Changes":"Add Candidate"}</button>
        </div>
      </Modal>

      {/* ══ JOB MODAL ══ */}
      <Modal id="job" title={editJobId ? "Edit Job Order" : "New Job Order"}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="modal-grid">
          <FR label="Order Reference *"><input key="ref" style={inp} value={jf.ref} onChange={e=>setJf(f=>({...f,ref:e.target.value}))} /></FR>
          <FR label="Client / Company *"><input key="client" style={inp} value={jf.client} onChange={e=>setJf(f=>({...f,client:e.target.value}))} /></FR>
          <FR label="Country"><select key="country" style={inp} value={jf.country} onChange={e=>setJf(f=>({...f,country:e.target.value}))}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select></FR>
          <FR label="City"><input key="city" style={inp} value={jf.city} onChange={e=>setJf(f=>({...f,city:e.target.value}))} /></FR>
          <FR label="Position / Trade *"><input key="position" style={inp} value={jf.position} onChange={e=>setJf(f=>({...f,position:e.target.value}))} /></FR>
          <FR label="Vacancies"><input key="vacancies" style={inp} type="number" min="1" value={jf.vacancies} onChange={e=>setJf(f=>({...f,vacancies:e.target.value}))} /></FR>
          <FR label="Salary (SAR)"><input key="salary" style={inp} value={jf.salary} onChange={e=>setJf(f=>({...f,salary:e.target.value}))} /></FR>
          <FR label="Deadline"><input key="deadline" style={inp} type="date" value={jf.deadline} onChange={e=>setJf(f=>({...f,deadline:e.target.value}))} /></FR>
          <FR label="Status"><select key="status" style={inp} value={jf.status} onChange={e=>setJf(f=>({...f,status:e.target.value}))}><option>Open</option><option>Filled</option><option>Closed</option></select></FR>
          <FR label="Contact Person"><input key="contact" style={inp} value={jf.contact} onChange={e=>setJf(f=>({...f,contact:e.target.value}))} /></FR>
          <FR label="Notes" span><textarea key="notes" style={{...inp,minHeight:55,resize:"vertical"}} value={jf.notes} onChange={e=>setJf(f=>({...f,notes:e.target.value}))} /></FR>
        </div>

        {/* POSITIONS SECTION */}
        <div style={{marginTop:20,borderTop:"1px solid #E5E7EB",paddingTop:16}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"#1F2937"}}>📍 Add More Job Positions for this Client (each treated equally)</div>

          {editJobId && positions.filter(p=>p.job_id===editJobId).length > 0 && (
            <div style={{marginBottom:14,background:"#ECFDF5",borderRadius:8,padding:"12px 14px",border:"1px solid #A7F3D0"}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:"#065F46"}}>Existing Positions on this Order:</div>
              {positions.filter(p=>p.job_id===editJobId).map((p)=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #A7F3D0"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:12,color:"#1F2937"}}>{p.position_name}</div>
                    <div style={{fontSize:11,color:"#6B7280"}}>Visas: {p.required_count} | Salary: SAR {p.salary||"—"}</div>
                  </div>
                  <button style={{background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:4,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:600}} onClick={()=>delPos(p.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          
          {/* SHOW ADDED POSITIONS */}
          {tempPositions && tempPositions.length > 0 && (
            <div style={{marginBottom:14,background:"#F3F4F6",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:"#374151"}}>Added Positions:</div>
              {tempPositions.map((p,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<tempPositions.length-1?"1px solid #E5E7EB":"none"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:12,color:"#1F2937"}}>{p.position_name}</div>
                    <div style={{fontSize:11,color:"#6B7280"}}>Visas: {p.required_count} | Salary: SAR {p.salary||"—"}</div>
                  </div>
                  <button style={{background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:4,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:600}} onClick={()=>setTempPositions(tempPositions.filter((_,idx)=>idx!==i))}>Remove</button>
                </div>
              ))}
            </div>
          )}

          {/* ADD NEW POSITION */}
          <div style={{background:"#F9FAFB",borderRadius:8,padding:"12px 14px",border:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"#374151"}}>Add New Position:</div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,alignItems:"flex-end"}}>
              <input 
                key="pos_name"
                style={{...inp,marginBottom:0}} 
                placeholder="Position (Chef, Driver, Manager)" 
                value={newPos.position_name} 
                onChange={e=>setNewPos(p=>({...p,position_name:e.target.value}))} 
              />
              <input 
                key="pos_visas"
                style={{...inp,marginBottom:0}} 
                type="number" 
                min="1" 
                placeholder="Visas Needed" 
                value={newPos.required_count} 
                onChange={e=>setNewPos(p=>({...p,required_count:Number(e.target.value)||1}))} 
              />
              <input 
                key="pos_salary"
                style={{...inp,marginBottom:0}} 
                placeholder="Salary (SAR)" 
                value={newPos.salary} 
                onChange={e=>setNewPos(p=>({...p,salary:e.target.value}))} 
              />
              <button 
                style={{background:"#10B981",color:"#fff",border:"none",borderRadius:4,padding:"8px 14px",cursor:"pointer",fontWeight:600,fontSize:12,whiteSpace:"nowrap"}} 
                onClick={()=>{
                  if(newPos.position_name.trim()){
                    setTempPositions([...tempPositions,{...newPos}]);
                    setNewPos({position_name:"",required_count:1,salary:""});
                  }else{
                    alert("Please enter position name");
                  }
                }}
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:18,paddingTop:14,borderTop:"1px solid #F3F4F6"}}>
          <button style={btn()} onClick={()=>{setModal(null);setTempPositions([]);setNewPos({position_name:"",required_count:1,salary:""});setEditJobId(null);}}>Cancel</button>
          <button style={pri} onClick={saveJob}>{editJobId ? "Save Changes" : "Create Job Order"} {tempPositions && tempPositions.length>0?`+ ${tempPositions.length} Position${tempPositions.length!==1?"s":""}`:""}</button>
        </div>
      </Modal>

      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow-x: hidden; }
        @media (max-width: 768px) {
          .sidebar { position: fixed !important; top: 56px !important; left: -220px; transition: left 0.3s ease; width: 220px !important; height: calc(100vh - 56px) !important; z-index: 99; }
          .sidebar[data-open="true"] { left: 0 !important; }
          .mobile-only { display: flex !important; }
          .main-content { margin-top: 56px; width: 100vw; overflow-x: hidden; padding: 0; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-grid { grid-template-columns: 1fr !important; }
          .job-grid { grid-template-columns: 1fr !important; }
          .modal-grid { grid-template-columns: 1fr !important; }
          .content-padding { padding: 12px 12px !important; }
          .desktop-header { padding: 12px 12px !important; font-size: 14px; }
          table { font-size: 12px !important; }
          table th, table td { padding: 8px 10px !important; }
          input, select, textarea { font-size: 16px !important; padding: 10px 12px !important; }
          button { padding: 10px 14px !important; font-size: 13px !important; min-height: 44px; }
        }
        @media (min-width: 769px) {
          .sidebar { display: flex !important; position: sticky !important; }
          .sidebar[data-open="true"] { left: 0 !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── AUDIT LOG (Admin only) ────────────────────────────────────────────────────
function AuditLog({ S, inp, btn }) {
  const [logs, setLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(100);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('activity_log').select('id, message, created_at, created_by, profiles(full_name)').order('created_at', { ascending: false }).limit(limit);
    if (staffFilter) query = query.eq('created_by', staffFilter);
    if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }, [staffFilter, dateFrom, dateTo, limit]);

  useEffect(() => {
    fetchLogs();
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setStaff(data || []));
  }, [fetchLogs]);

  const filtered = logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ background:"#FEF2F2", border:"1px solid #FEE2E2", borderRadius:12, padding:"14px 18px", marginBottom:18 }}>
        <div style={{ fontWeight:700, fontSize:14, color:"#991B1B" }}>🛡️ Full Audit Trail</div>
        <div style={{ fontSize:12, color:"#B91C1C", marginTop:4 }}>Every create/update action across the ATS and CRM, timestamped and attributed to the staff member who did it. Read-only — this cannot be edited or deleted from the app.</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <select style={{...inp, width:"auto"}} value={staffFilter} onChange={e=>setStaffFilter(e.target.value)}>
          <option value="">All staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <input style={{...inp, width:"auto"}} type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} title="From date" />
        <input style={{...inp, width:"auto"}} type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} title="To date" />
        <input style={{...inp, width:240}} placeholder="Search action text…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{...inp, width:"auto"}} value={limit} onChange={e=>setLimit(Number(e.target.value))}>
          <option value={100}>Last 100</option>
          <option value={300}>Last 300</option>
          <option value={1000}>Last 1000</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color:"#9CA3AF", textAlign:"center", padding:30 }}>Loading…</div>
      ) : (
        <div style={S.card}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Date & Time","Staff Member","Action"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{...S.td, whiteSpace:"nowrap", fontSize:12, color:"#6B7280"}}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{...S.td, fontWeight:600}}>{l.profiles?.full_name || "Unknown"}</td>
                  <td style={S.td}>{l.message}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={3} style={{textAlign:"center", padding:30, color:"#9CA3AF"}}>No activity matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffManagement({ S, inp, btn, pri, jobs }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");
  const [creatingStaff, setCreatingStaff] = useState(false);
  const clientNames = [...new Set(jobs.map(j=>j.client))];

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setStaff(data||[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const updateRole = async (id, role) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    fetchStaff();
  };

  const deleteStaff = async (id, name) => {
    if (!window.confirm(`Delete ${name}'s account? This cannot be undone.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/admin-manage-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: "delete", userId: id, requesterId: session?.user?.id }),
    });
    const result = await res.json();
    if (result.error) { alert(result.error); return; }
    fetchStaff();
  };

  const editStaffEmail = async (id, currentEmail) => {
    const newEmail = window.prompt("Enter corrected email address:", currentEmail);
    if (!newEmail || newEmail === currentEmail) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/admin-manage-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: "update_email", userId: id, newEmail, requesterId: session?.user?.id }),
    });
    const result = await res.json();
    if (result.error) { alert(result.error); return; }
    fetchStaff();
  };

  const toggleClient = async (id, client, current) => {
    const list = current || [];
    const updated = list.includes(client) ? list.filter(c=>c!==client) : [...list, client];
    await supabase.from("profiles").update({ assigned_clients: updated }).eq("id", id);
    fetchStaff();
  };

  const toggleAtsAccess = async (id, current) => {
    await supabase.from("profiles").update({ ats_access: !current }).eq("id", id);
    fetchStaff();
  };

  const toggleCrmAccess = async (id, current) => {
    await supabase.from("profiles").update({ crm_access: !current, crm_sections: !current ? ['dashboard','clients','campaigns','reports'] : [] }).eq("id", id);
    fetchStaff();
  };

  const toggleCrmSection = async (id, section, current) => {
    const list = current || [];
    const updated = list.includes(section) ? list.filter(s=>s!==section) : [...list, section];
    await supabase.from("profiles").update({ crm_sections: updated }).eq("id", id);
    fetchStaff();
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewStaffPassword(pwd);
  };

  const createStaffAccount = async () => {
    if (!newStaffEmail.trim() || !newStaffName.trim() || !newStaffPassword.trim()) {
      alert("Please fill in all fields and generate a password");
      return;
    }
    setCreatingStaff(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/admin-manage-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: "create",
          email: newStaffEmail,
          password: newStaffPassword,
          fullName: newStaffName,
          requesterId: session?.user?.id,
        }),
      });
      const result = await res.json();
      if (result.error) { alert(result.error); setCreatingStaff(false); return; }

      setCreatedMessage(`✓ Account created! Email: ${newStaffEmail} | Password: ${newStaffPassword}`);
      setNewStaffEmail("");
      setNewStaffName("");
      setNewStaffPassword("");

      setTimeout(() => {
        setCreatedMessage("");
        setShowCreateForm(false);
        fetchStaff();
      }, 3000);
    } catch (err) {
      alert("Error: " + err.message);
    }
    setCreatingStaff(false);
  };

  if (loading) return <div style={{color:"#9CA3AF"}}>Loading staff…</div>;

  return (
    <div>
      <div style={{ background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:12, padding:"14px 18px", marginBottom:18 }}>
        <div style={{ fontWeight:700, fontSize:14, color:"#3730A3" }}>🔑 Staff Access Management ({staff.length} accounts)</div>
        <div style={{ fontSize:12, color:"#4338CA", marginTop:4 }}>You create staff accounts with temporary passwords. Share credentials via WhatsApp. Admin: full access. Manager: limited to assigned clients. Staff: data entry only.</div>
      </div>

      {/* CREATE STAFF FORM */}
      {showCreateForm && (
        <div style={{ ...S.card, marginBottom:18, background:"#F0FDF4", borderColor:"#BBF7D0" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"#166534" }}>➕ Add New Staff Member</div>
          <input style={{ ...inp, marginBottom:10 }} placeholder="Full name" value={newStaffName} onChange={e=>setNewStaffName(e.target.value)} />
          <input style={{ ...inp, marginBottom:10 }} type="email" placeholder="Email address" value={newStaffEmail} onChange={e=>setNewStaffEmail(e.target.value)} />
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input style={{ ...inp, marginBottom:0, flex:1 }} placeholder="Temporary password" value={newStaffPassword} readOnly />
            <button style={btn()} onClick={generatePassword}>Generate</button>
          </div>
          {createdMessage && <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", borderRadius:8, padding:"10px 12px", fontSize:11, marginBottom:12, wordBreak:"break-all", fontFamily:"monospace" }}>{createdMessage}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button style={pri} onClick={createStaffAccount} disabled={creatingStaff}>{creatingStaff?"Creating…":"Create Account"}</button>
            <button style={btn()} onClick={()=>setShowCreateForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <button style={{...pri, marginBottom:18}} onClick={()=>{setShowCreateForm(true);setCreatedMessage("")}}>➕ Add New Staff Member</button>
      )}

      <div style={S.card}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Name","Email","Role","ATS Access","CRM Access","CRM Sections","Client Access (Managers only)","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {staff.map(s=>(
              <tr key={s.id}>
                <td style={S.td}>{s.full_name}</td>
                <td style={{...S.td, fontSize:11, color:"#6B7280"}}>{s.email}</td>
                <td style={S.td}>
                  <select style={{ ...inp, width:"auto", fontSize:12 }} value={s.role} onChange={e=>updateRole(s.id, e.target.value)}>
                    <option value="admin">Admin</option><option value="manager">Manager</option><option value="staff">Staff</option>
                  </select>
                </td>
                <td style={S.td}>
                  <button style={{...btn({padding:"4px 10px",fontSize:11}), background:s.ats_access?"#ECFDF5":"#FEF2F2", color:s.ats_access?"#059669":"#DC2626", borderColor:s.ats_access?"#A7F3D0":"#FEE2E2"}} onClick={()=>toggleAtsAccess(s.id, s.ats_access)}>{s.ats_access?"✓ Enabled":"✕ Disabled"}</button>
                </td>
                <td style={S.td}>
                  <button style={{...btn({padding:"4px 10px",fontSize:11}), background:s.crm_access?"#ECFDF5":"#FEF2F2", color:s.crm_access?"#059669":"#DC2626", borderColor:s.crm_access?"#A7F3D0":"#FEE2E2"}} onClick={()=>toggleCrmAccess(s.id, s.crm_access)}>{s.crm_access?"✓ Enabled":"✕ Disabled"}</button>
                </td>
                <td style={S.td}>
                  {s.crm_access ? (
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {["dashboard","clients","campaigns","reports"].map(sec=>(
                        <button key={sec} style={{ ...btn({ padding:"3px 7px", fontSize:10 }), background:(s.crm_sections||[]).includes(sec)?"#EEF2FF":"#fff", color:(s.crm_sections||[]).includes(sec)?"#6366F1":"#9CA3AF", borderColor:(s.crm_sections||[]).includes(sec)?"#C7D2FE":"#E5E7EB" }}
                          onClick={()=>toggleCrmSection(s.id, sec, s.crm_sections)}>{sec}</button>
                      ))}
                    </div>
                  ) : <span style={{fontSize:11,color:"#D1D5DB"}}>—</span>}
                </td>
                <td style={S.td}>
                  {s.role==="manager" ? (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {clientNames.map(c=>(
                        <button key={c} style={{ ...btn({ padding:"3px 9px", fontSize:11 }), background:(s.assigned_clients||[]).includes(c)?"#EEF2FF":"#fff", color:(s.assigned_clients||[]).includes(c)?"#6366F1":"#9CA3AF", borderColor:(s.assigned_clients||[]).includes(c)?"#C7D2FE":"#E5E7EB" }}
                          onClick={()=>toggleClient(s.id, c, s.assigned_clients)}>{c}</button>
                      ))}
                    </div>
                  ) : <span style={{ fontSize:12, color:"#9CA3AF" }}>{s.role==="admin"?"All clients":"N/A"}</span>}
                </td>
                <td style={S.td}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={btn({padding:"4px 10px",fontSize:11})} onClick={()=>editStaffEmail(s.id, s.email)}>Edit Email</button>
                    <button style={btn({padding:"4px 10px",fontSize:11,color:"#EF4444",borderColor:"#FEE2E2"})} onClick={()=>deleteStaff(s.id, s.full_name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
