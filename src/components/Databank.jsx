import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";
import { EMPTY_CAND, uid, fmtDate, today, COUNTRIES, sanitizeForDb } from "../lib/constants";

export default function Databank({ candidates, jobs, profile, onRefresh, addLog, S, inp, btn, pri, FR }) {
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [gccFilter, setGccFilter] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("");
  const [showDeployed, setShowDeployed] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [cf, setCf] = useState(EMPTY_CAND);
  const [uploading, setUploading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const photoInputRef = useRef(null);
  const cvInputRef = useRef(null);

  const unassignedCands = candidates.filter(c => c.stage === "databank" || !c.job_id);
  const deployedCands = candidates.filter(c => c.stage === "deployed");
  const databankCands = showDeployed ? [...unassignedCands, ...deployedCands] : unassignedCands;
  const trades = [...new Set(candidates.map(c=>c.trade).filter(Boolean))];
  const nationalities = [...new Set(candidates.map(c=>c.nationality).filter(Boolean))];
  const sources = [...new Set(candidates.map(c=>c.source).filter(Boolean))];

  const visible = databankCands.filter(c=>{
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.trade||"").toLowerCase().includes(q) || (c.passport||"").toLowerCase().includes(q) || (c.cnic||"").includes(q);
    const matchesTrade = !tradeFilter || c.trade===tradeFilter;
    const matchesExp = !experienceFilter || c.experience===experienceFilter;
    const matchesNat = !nationalityFilter || c.nationality===nationalityFilter;
    const matchesSource = !sourceFilter || c.source===sourceFilter;
    const matchesGcc = !gccFilter || (gccFilter==="yes" ? c.has_gcc_experience : !c.has_gcc_experience);
    const matchesLicense = !licenseFilter || c.driving_license_type===licenseFilter;
    return matchesSearch && matchesTrade && matchesExp && matchesNat && matchesSource && matchesGcc && matchesLicense;
  });

  const viewCand = viewId ? candidates.find(c=>c.id===viewId) : null;

  const exportDatabank = async () => {
    if (!visible.length) { alert("No candidates to export"); return; }
    const headers = ["S.No","Name","Father Name","CNIC","Passport","Phone","Email","Trade","Experience","Education","Nationality","DOB","Source","Photo","CV","Notes"];
    const rows = visible.map((c,i)=>[i+1,c.name,c.father_name,c.cnic,c.passport,c.phone,c.email,c.trade,c.experience,c.education,c.nationality,c.date_of_birth||"",c.source||"",c.photo_url?"Yes":"No",c.cv_url?"Yes":"No",c.databank_notes||""]);
    const ws = XLSX.utils.aoa_to_sheet([[`CV DATABANK EXPORT — Riverside Enterprises | Date: ${today()}`],[`Filters: Trade=${tradeFilter||"All"} | Experience=${experienceFilter||"All"} | Nationality=${nationalityFilter||"All"} | Source=${sourceFilter||"All"}`],[],headers,...rows]);
    ws["!cols"] = headers.map(()=>({wch:16}));
    ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:15}},{s:{r:1,c:0},e:{r:1,c:15}}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Databank");
    XLSX.writeFile(wb, `Riverside_Databank_${today().replace(/\//g,"-")}.xlsx`);
  };

  const uploadFile = async (file, bucket) => {
    const ext = file.name.split(".").pop();
    const path = `${uid()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { alert("Upload failed: " + error.message); return null; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file, "photos");
    if (url) setCf(f=>({...f, photo_url:url}));
    setUploading(false);
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file, "cvs");
    if (url) setCf(f=>({...f, cv_url:url}));
    setUploading(false);
  };

  // Fetches an image URL and converts it to a base64 data URL for embedding in the PDF
  async function urlToDataUrl(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function generateStandardCV(c) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, pageH = 297, margin = 15;
    let y = 0;

    const navy = [11, 37, 69];
    const gold = [212, 160, 23];
    const gray = [107, 114, 128];
    const lightGray = [243, 244, 246];

    function ensureSpace(neededMm) {
      if (y + neededMm > pageH - 18) {
        doc.addPage();
        y = 18;
      }
    }

    function sectionTitle(label) {
      ensureSpace(12);
      y += 6;
      doc.setFillColor(...navy);
      doc.rect(margin, y - 4, 3, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...navy);
      doc.text(label.toUpperCase(), margin + 6, y);
      y += 3;
      doc.setDrawColor(...lightGray);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    function fieldRow(pairs) {
      for (let i = 0; i < pairs.length; i += 2) {
        ensureSpace(8);
        const colW = (pageW - margin * 2) / 2;
        [pairs[i], pairs[i + 1]].forEach((pair, idx) => {
          if (!pair) return;
          const x = margin + idx * colW;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...gray);
          doc.text(pair[0].toUpperCase(), x, y);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 30, 30);
          doc.text(String(pair[1] || "—"), x, y + 5);
        });
        y += 11;
      }
    }

    function paragraph(text) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(text || "—", pageW - margin * 2);
      lines.forEach((line) => { ensureSpace(6); doc.text(line, margin, y); y += 5.5; });
      y += 2;
    }

    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text("RIVERSIDE ENTERPRISES RECRUITMENT CONSULTANTS", margin, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(220, 220, 220);
    doc.text("Government Licensed Overseas Employment Promoter \u00b7 Lahore, Pakistan", margin, 14.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(c.name || "Candidate", margin, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...gold);
    doc.text((c.trade || "Position not specified").toUpperCase(), margin, 33.5);

    const photoW = 26, photoH = 30, photoX = pageW - margin - photoW, photoY = 4;
    doc.setFillColor(255, 255, 255);
    doc.rect(photoX, photoY, photoW, photoH, "F");
    if (c.photo_url) {
      const dataUrl = await urlToDataUrl(c.photo_url);
      if (dataUrl) {
        try { doc.addImage(dataUrl, "JPEG", photoX, photoY, photoW, photoH); } catch { /* unsupported format, skip silently */ }
      }
    }

    y = 46;

    sectionTitle("Personal Information");
    fieldRow([
      ["Father's Name", c.father_name], ["Date of Birth", c.date_of_birth ? fmtDate(c.date_of_birth) : null],
      ["Nationality", c.nationality], ["Marital Status", c.marital_status],
      ["Passport No.", c.passport], ["Passport Expiry", c.passport_expiry ? fmtDate(c.passport_expiry) : null],
      ["CNIC", c.cnic], ["Phone / WhatsApp", c.phone],
    ]);

    if (c.has_gcc_experience || c.gcc_countries || c.gcc_experience_years) {
      sectionTitle("Gulf / GCC Work Experience");
      fieldRow([
        ["Countries Worked In", c.gcc_countries], ["Years of GCC Experience", c.gcc_experience_years],
      ]);
    }

    sectionTitle("Work Experience");
    paragraph(c.work_history || `${c.experience ? c.experience + " years" : "Experience"} as ${c.trade || "tradesperson"}.`);

    if (c.skills) {
      sectionTitle("Key Skills");
      paragraph(c.skills);
    }

    sectionTitle("Education & Qualifications");
    paragraph(c.education);

    if (c.languages) {
      sectionTitle("Languages");
      paragraph(c.languages);
    }

    sectionTitle("Certifications & Licenses");
    fieldRow([
      ["Trade Test (Takamol)", c.trade_test_status], ["Driving License", c.driving_license_type || "Not applicable"],
      ["License Country", c.driving_license_country], ["License Status", c.driving_license_status],
    ]);
    if (c.additional_certifications) {
      paragraph(c.additional_certifications);
    }

    sectionTitle("Deployment Readiness");
    fieldRow([
      ["Medical (GAMCA)", c.medical_status], ["Passport Validity", c.passport_expiry ? fmtDate(c.passport_expiry) : "—"],
    ]);

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...lightGray);
      doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...gray);
      doc.text("Riverside Enterprises Recruitment Consultants, Lahore, Pakistan \u00b7 Govt. Licensed Overseas Employment Promoter", margin, pageH - 9);
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 9, { align: "right" });
    }

    doc.save(`CV_${(c.name || "candidate").replace(/\s+/g, "_")}_Riverside.pdf`);
  }

  const openAdd = () => { setEditId(null); setCf(EMPTY_CAND); setModal(true); };
  const openEdit = (c) => { setEditId(c.id); setCf({...EMPTY_CAND, ...c}); setModal(true); };
  const openView = (c) => setViewId(c.id);

  const saveCand = async () => {
    if (!cf.name.trim()) { alert("Name is required"); return; }
    const payload = sanitizeForDb({ ...cf, created_by: profile.id });
    delete payload.id;
    if (editId) {
      const { error } = await supabase.from("candidates").update(payload).eq("id", editId);
      if (error) { alert(error.message); return; }
      addLog(`Updated databank profile: ${cf.name}`);
    } else {
      const { error } = await supabase.from("candidates").insert([{ ...payload, stage:"databank" }]);
      if (error) { alert(error.message); return; }
      addLog(`Added to databank: ${cf.name} — ${cf.trade}`);
    }
    setModal(false); setEditId(null); setCf(EMPTY_CAND);
    onRefresh();
  };

  const deleteCand = async (id) => {
    if (!window.confirm("Remove this candidate from the databank?")) return;
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    addLog("Removed candidate from databank");
    onRefresh();
  };

  const assignToJob = async (candId, jobId) => {
    const job = jobs.find(j=>j.id===jobId);
    const { error } = await supabase.from("candidates").update({ job_id: jobId, stage: "shortlist" }).eq("id", candId);
    if (error) { alert(error.message); return; }
    const c = candidates.find(x=>x.id===candId);
    addLog(`${c?.name} assigned to ${job?.client} (${job?.ref})`);
    onRefresh();
  };

  const reassignToDatabank = async (candId) => {
    const { error } = await supabase.from("candidates").update({ job_id: null, stage: "databank" }).eq("id", candId);
    if (error) { alert(error.message); return; }
    const c = candidates.find(x=>x.id===candId);
    addLog(`${c?.name} moved back to CV Databank (available for reassignment)`);
    onRefresh();
  };

  // Bulk CSV-style paste import: Name, Trade, Phone, CNIC, Passport — one per line, comma separated
  const handleBulkImport = async () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map(line => {
      const [name, trade, phone, cnic, passport] = line.split(",").map(s=>s?.trim()||"");
      return sanitizeForDb({ ...EMPTY_CAND, name, trade, phone, cnic, passport, stage:"databank", created_by: profile.id });
    }).filter(r=>r.name);
    if (!rows.length) { alert("No valid rows found. Format: Name, Trade, Phone, CNIC, Passport"); return; }
    const { error } = await supabase.from("candidates").insert(rows);
    if (error) { alert(error.message); return; }
    addLog(`Bulk imported ${rows.length} candidates to databank`);
    setBulkText(""); setBulkMode(false);
    onRefresh();
  };

  return (
    <div>
      <div style={{ background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:"#3730A3" }}>📁 CV Databank</div>
          <div style={{ fontSize:12, color:"#4338CA", marginTop:2 }}>Your full candidate pool, independent of any job order. Assign candidates to job orders when a demand comes in.</div>
        </div>
        <div style={{ fontSize:24, fontWeight:700, color:"#4338CA" }}>{databankCands.length}</div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input style={{ ...inp, maxWidth:220 }} placeholder="Search name, trade, CNIC…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{ ...inp, width:"auto" }} value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}>
          <option value="">All trades</option>
          {trades.map(t=><option key={t}>{t}</option>)}
        </select>
        <select style={{ ...inp, width:"auto" }} value={experienceFilter} onChange={e=>setExperienceFilter(e.target.value)}>
          <option value="">All experience</option>
          {[...new Set(candidates.map(c=>c.experience).filter(Boolean))].sort().map(e=><option key={e}>{e} years</option>)}
        </select>
        <select style={{ ...inp, width:"auto" }} value={nationalityFilter} onChange={e=>setNationalityFilter(e.target.value)}>
          <option value="">All nationalities</option>
          {nationalities.map(n=><option key={n}>{n}</option>)}
        </select>
        <select style={{ ...inp, width:"auto" }} value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {sources.map(s=><option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inp, width:"auto", borderColor:"#A7F3D0" }} value={gccFilter} onChange={e=>setGccFilter(e.target.value)}>
          <option value="">GCC Experience: All</option>
          <option value="yes">✓ Has GCC/Foreign Experience</option>
          <option value="no">No GCC Experience</option>
        </select>
        <select style={{ ...inp, width:"auto", borderColor:"#A7F3D0" }} value={licenseFilter} onChange={e=>setLicenseFilter(e.target.value)}>
          <option value="">Driving License: All</option>
          <option value="Light Vehicle">Light Vehicle</option>
          <option value="Heavy Truck">Heavy Truck</option>
          <option value="Trailer">Trailer</option>
          <option value="Dyna">Dyna</option>
          <option value="Heavy Equipment">Heavy Equipment</option>
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          {deployedCands.length>0 && <button style={btn({fontSize:12})} onClick={()=>setShowDeployed(!showDeployed)}>{showDeployed?"Hide":"Show"} Deployed ({deployedCands.length})</button>}
          <button style={btn({fontSize:12})} onClick={exportDatabank} disabled={!visible.length}>📊 Export to Excel</button>
          <button style={btn()} onClick={()=>setBulkMode(!bulkMode)}>📋 Bulk Import</button>
          <button style={pri} onClick={openAdd}>+ Add Candidate</button>
        </div>
      </div>

      {bulkMode && (
        <div style={{ ...S.card, padding:"16px 18px", marginBottom:16 }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:6 }}>Bulk import candidates</div>
          <div style={{ fontSize:12, color:"#6B7280", marginBottom:10 }}>Paste one candidate per line, comma-separated: <code>Name, Trade, Phone, CNIC, Passport</code></div>
          <textarea style={{ ...inp, minHeight:120, fontFamily:"monospace", fontSize:12 }} value={bulkText} onChange={e=>setBulkText(e.target.value)}
            placeholder="Muhammad Ali, Electrician, +923001234567, 35202-1234567-1, AC1234567&#10;Hassan Raza, Welder, +923009876543, 35202-7654321-3, AC7654321" />
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button style={pri} onClick={handleBulkImport}>Import All</button>
            <button style={btn()} onClick={()=>setBulkMode(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Photo","Name & Trade","CNIC","Passport","Phone","GCC Exp.","License","Source","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.length ? visible.map(c=>(
                <tr key={c.id}>
                  <td style={S.td} onClick={()=>openView(c)} title="Click to view full profile" >
                    {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{ width:36, height:36, borderRadius:8, objectFit:"cover", cursor:"pointer" }} />
                      : <div style={{ width:36, height:36, borderRadius:8, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#9CA3AF", cursor:"pointer" }}>{c.name.charAt(0)}</div>}
                  </td>
                  <td style={S.td} onClick={()=>openView(c)} title="Click to view full profile">
                    <div style={{ fontWeight:600, cursor:"pointer", color:"#4338CA" }}>{c.name}</div>
                    <div style={{ fontSize:12, color:"#6B7280" }}>{c.trade} {c.experience?`· ${c.experience} yrs`:""}</div>
                  </td>
                  <td style={{ ...S.td, fontSize:12 }}>{c.cnic||"—"}</td>
                  <td style={{ ...S.td, fontFamily:"monospace", fontSize:12 }}>{c.passport||"—"}</td>
                  <td style={{ ...S.td, fontSize:12 }}>{c.phone||"—"}</td>
                  <td style={S.td}>
                    {c.has_gcc_experience
                      ? <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"#D1FAE5", color:"#065F46" }}>✓ {c.gcc_countries||"GCC"}</span>
                      : <span style={{ fontSize:11, color:"#D1D5DB" }}>—</span>}
                  </td>
                  <td style={S.td}>
                    {c.driving_license_type
                      ? <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background: c.driving_license_status==="Valid" ? "#DBEAFE" : "#FEF3C7", color: c.driving_license_status==="Valid" ? "#1E3A8A" : "#92400E" }}>{c.driving_license_type} {c.driving_license_status?`(${c.driving_license_status})`:""}</span>
                      : <span style={{ fontSize:11, color:"#D1D5DB" }}>—</span>}
                  </td>
                  <td style={{ ...S.td, fontSize:12 }}>{c.source||"—"}</td>
                  <td style={S.td}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button style={btn({ padding:"4px 9px", fontSize:11, color:"#4338CA", borderColor:"#C7D2FE" })} onClick={()=>openView(c)}>View</button>
                      <button style={btn({ padding:"4px 9px", fontSize:11, color:"#0B2545", borderColor:"#D4A017" })} onClick={()=>generateStandardCV(c)}>📑 CV</button>
                      {c.stage!=="deployed" ? (
                        <>
                          <select style={{ ...inp, width:"auto", padding:"4px 8px", fontSize:11 }} onChange={e=>{ if(e.target.value) assignToJob(c.id, e.target.value); e.target.value=""; }} defaultValue="">
                            <option value="" disabled>Assign to job…</option>
                            {jobs.filter(j=>j.status==="Open").map(j=><option key={j.id} value={j.id}>{j.ref} — {j.client}</option>)}
                          </select>
                          <button style={btn({ padding:"4px 9px", fontSize:11 })} onClick={()=>openEdit(c)}>Edit</button>
                          <button style={btn({ padding:"4px 9px", fontSize:11, color:"#EF4444", borderColor:"#FEE2E2" })} onClick={()=>deleteCand(c.id)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button style={btn({ padding:"4px 9px", fontSize:11, background:"#F0FDF4", color:"#10B981", borderColor:"#BBF7D0" })} onClick={()=>reassignToDatabank(c.id)}>↩ Re-assign</button>
                          <button style={btn({ padding:"4px 9px", fontSize:11 })} onClick={()=>openEdit(c)}>Edit</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={9} style={{ textAlign:"center", padding:40, color:"#9CA3AF" }}>No candidates in databank yet. Add or bulk import to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ VIEW PROFILE MODAL (read-only, with CV link) ══ */}
      {viewCand && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
             onClick={e=>e.target===e.currentTarget && setViewId(null)}>
          <div style={{ background:"#fff", borderRadius:16, width:560, maxHeight:"92vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:"1px solid #F3F4F6", position:"sticky", top:0, background:"#fff" }}>
              <span style={{ fontSize:15, fontWeight:700 }}>Candidate Profile</span>
              <button style={btn({ padding:"4px 10px" })} onClick={()=>setViewId(null)}>✕</button>
            </div>
            <div style={{ padding:"20px 22px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
                {viewCand.photo_url ? <img src={viewCand.photo_url} alt="" style={{ width:72, height:72, borderRadius:12, objectFit:"cover" }} />
                  : <div style={{ width:72, height:72, borderRadius:12, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:700, color:"#9CA3AF" }}>{viewCand.name.charAt(0)}</div>}
                <div>
                  <div style={{ fontWeight:700, fontSize:17 }}>{viewCand.name}</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>{viewCand.trade} {viewCand.experience?`· ${viewCand.experience} yrs experience`:""}</div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                {[["Father's Name", viewCand.father_name], ["CNIC", viewCand.cnic], ["Phone", viewCand.phone], ["Email", viewCand.email],
                  ["Passport", viewCand.passport], ["Passport Expiry", viewCand.passport_expiry?fmtDate(viewCand.passport_expiry):"—"],
                  ["Nationality", viewCand.nationality], ["Education", viewCand.education],
                  ["Date of Birth", viewCand.date_of_birth?fmtDate(viewCand.date_of_birth):"—"], ["Marital Status", viewCand.marital_status], ["Source", viewCand.source]].map(([k,v])=>(
                  <div key={k} style={{ background:"#F9FAFB", borderRadius:8, padding:"9px 11px" }}>
                    <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase" }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, wordBreak:"break-word" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>

              {viewCand.databank_notes && (
                <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"10px 12px", marginBottom:16, fontSize:13 }}>
                  <div style={{ fontSize:11, color:"#92400E", fontWeight:600, marginBottom:4 }}>NOTES</div>
                  {viewCand.databank_notes}
                </div>
              )}

              {(viewCand.has_gcc_experience || viewCand.driving_license_type) && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                  {viewCand.has_gcc_experience && (
                    <div style={{ background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#065F46", fontWeight:600 }}>🌍 GCC EXPERIENCE</div>
                      <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{viewCand.gcc_countries || "Yes"}{viewCand.gcc_experience_years ? ` · ${viewCand.gcc_experience_years} yrs` : ""}</div>
                    </div>
                  )}
                  {viewCand.driving_license_type && (
                    <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#1E3A8A", fontWeight:600 }}>🚛 DRIVING LICENSE</div>
                      <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{viewCand.driving_license_type} · {viewCand.driving_license_country || "—"} ({viewCand.driving_license_status || "—"})</div>
                    </div>
                  )}
                </div>
              )}

              {(viewCand.work_history || viewCand.skills || viewCand.languages || viewCand.additional_certifications) && (
                <div style={{ display:"grid", gap:8, marginBottom:16 }}>
                  {viewCand.work_history && (
                    <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#374151", fontWeight:600, marginBottom:2 }}>💼 WORK HISTORY</div>
                      <div style={{ fontSize:12, whiteSpace:"pre-wrap" }}>{viewCand.work_history}</div>
                    </div>
                  )}
                  {viewCand.skills && (
                    <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#374151", fontWeight:600, marginBottom:2 }}>🛠 KEY SKILLS</div>
                      <div style={{ fontSize:12 }}>{viewCand.skills}</div>
                    </div>
                  )}
                  {viewCand.languages && (
                    <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#374151", fontWeight:600, marginBottom:2 }}>🗣 LANGUAGES</div>
                      <div style={{ fontSize:12 }}>{viewCand.languages}</div>
                    </div>
                  )}
                  {viewCand.additional_certifications && (
                    <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"#374151", fontWeight:600, marginBottom:2 }}>📜 ADDITIONAL CERTIFICATIONS</div>
                      <div style={{ fontSize:12 }}>{viewCand.additional_certifications}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {viewCand.cv_url ? (
                  <a href={viewCand.cv_url} target="_blank" rel="noreferrer" style={{ ...btn({ background:"#EEF2FF", color:"#4338CA", borderColor:"#C7D2FE", textAlign:"center", flex:1 }), textDecoration:"none", display:"inline-block" }}>📄 View Original CV</a>
                ) : (
                  <div style={{ flex:1, textAlign:"center", padding:"8px 14px", fontSize:13, color:"#9CA3AF", border:"1px dashed #E5E7EB", borderRadius:8 }}>No CV uploaded</div>
                )}
                {viewCand.phone && <a href={`tel:${viewCand.phone}`} style={{ ...btn({ color:"#3B82F6", borderColor:"#BFDBFE", textAlign:"center", flex:1 }), textDecoration:"none", display:"inline-block" }}>📞 Call</a>}
              </div>
              <div style={{ marginBottom:18 }}>
                <button onClick={()=>generateStandardCV(viewCand)} style={{ ...btn({ background:"#0B2545", color:"#fff", border:"none", width:"100%" }) }}>📑 Generate Standard CV (PDF)</button>
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingTop:14, borderTop:"1px solid #F3F4F6" }}>
                <button style={btn()} onClick={()=>setViewId(null)}>Close</button>
                <button style={pri} onClick={()=>{ setViewId(null); openEdit(viewCand); }}>Edit Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
             onClick={e=>e.target===e.currentTarget && setModal(false)}>
          <div style={{ background:"#fff", borderRadius:16, width:640, maxHeight:"92vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:"1px solid #F3F4F6", position:"sticky", top:0, background:"#fff" }}>
              <span style={{ fontSize:15, fontWeight:700 }}>{editId?"Edit Candidate":"Add to CV Databank"}</span>
              <button style={btn({ padding:"4px 10px" })} onClick={()=>setModal(false)}>✕</button>
            </div>
            <div style={{ padding:"20px 22px" }}>

              {/* Photo upload */}
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
                {cf.photo_url ? <img src={cf.photo_url} alt="" style={{ width:72, height:72, borderRadius:12, objectFit:"cover" }} />
                  : <div style={{ width:72, height:72, borderRadius:12, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color:"#9CA3AF" }}>📷</div>}
                <div>
                  <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} />
                  <button style={btn({ fontSize:12 })} onClick={()=>photoInputRef.current.click()} disabled={uploading}>{uploading?"Uploading…":"Upload Photo"}</button>
                  <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>JPG or PNG, passport-size preferred</div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FR label="Full Name *"><input style={inp} value={cf.name} onChange={e=>setCf(f=>({...f,name:e.target.value}))} placeholder="Muhammad Usman" /></FR>
                <FR label="Father's Name"><input style={inp} value={cf.father_name} onChange={e=>setCf(f=>({...f,father_name:e.target.value}))} /></FR>
                <FR label="CNIC"><input style={inp} value={cf.cnic} onChange={e=>setCf(f=>({...f,cnic:e.target.value}))} placeholder="35202-XXXXXXX-X" /></FR>
                <FR label="Phone"><input style={inp} value={cf.phone} onChange={e=>setCf(f=>({...f,phone:e.target.value}))} placeholder="+92 300 XXXXXXX" /></FR>
                <FR label="Email"><input style={inp} value={cf.email} onChange={e=>setCf(f=>({...f,email:e.target.value}))} /></FR>
                <FR label="Date of Birth"><input style={inp} type="date" value={cf.date_of_birth} onChange={e=>setCf(f=>({...f,date_of_birth:e.target.value}))} /></FR>
                <FR label="Trade / Position *"><input style={inp} value={cf.trade} onChange={e=>setCf(f=>({...f,trade:e.target.value}))} placeholder="Electrician, Driver…" /></FR>
                <FR label="Experience (years)"><input style={inp} type="number" min="0" value={cf.experience} onChange={e=>setCf(f=>({...f,experience:e.target.value}))} /></FR>
                <FR label="Education"><input style={inp} value={cf.education} onChange={e=>setCf(f=>({...f,education:e.target.value}))} placeholder="Matric, Diploma…" /></FR>
                <FR label="Nationality"><input style={inp} value={cf.nationality} onChange={e=>setCf(f=>({...f,nationality:e.target.value}))} /></FR>
                <FR label="Passport No."><input style={inp} value={cf.passport} onChange={e=>setCf(f=>({...f,passport:e.target.value}))} /></FR>
                <FR label="Passport Expiry"><input style={inp} type="date" value={cf.passport_expiry} onChange={e=>setCf(f=>({...f,passport_expiry:e.target.value}))} /></FR>
                <FR label="Source"><input style={inp} value={cf.source} onChange={e=>setCf(f=>({...f,source:e.target.value}))} placeholder="Walk-in, referral, agent…" /></FR>
                <FR label="Marital Status">
                  <select style={inp} value={cf.marital_status||""} onChange={e=>setCf(f=>({...f,marital_status:e.target.value}))}>
                    <option value="">— Not specified —</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </FR>
              </div>

              <div style={{ background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:10, padding:"14px 16px", marginTop:14, marginBottom:14 }}>
                <div style={{ fontWeight:700, fontSize:13, color:"#065F46", marginBottom:10 }}>🌍 GCC / Foreign Work Experience</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <FR label="Has GCC/Foreign Experience?">
                    <select style={inp} value={cf.has_gcc_experience ? "yes" : "no"} onChange={e=>setCf(f=>({...f,has_gcc_experience: e.target.value==="yes"}))}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </FR>
                  {cf.has_gcc_experience && (
                    <>
                      <FR label="Countries Worked In"><input style={inp} value={cf.gcc_countries||""} onChange={e=>setCf(f=>({...f,gcc_countries:e.target.value}))} placeholder="Saudi Arabia, UAE, Qatar" /></FR>
                      <FR label="Years of Foreign Experience"><input style={inp} value={cf.gcc_experience_years||""} onChange={e=>setCf(f=>({...f,gcc_experience_years:e.target.value}))} placeholder="e.g. 3" /></FR>
                    </>
                  )}
                </div>
              </div>

              <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontWeight:700, fontSize:13, color:"#1E3A8A", marginBottom:10 }}>🚛 Driving License (if applicable)</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                  <FR label="License Type">
                    <select style={inp} value={cf.driving_license_type||""} onChange={e=>setCf(f=>({...f,driving_license_type:e.target.value}))}>
                      <option value="">None</option>
                      <option value="Light Vehicle">Light Vehicle</option>
                      <option value="Heavy Truck">Heavy Truck</option>
                      <option value="Trailer">Trailer</option>
                      <option value="Dyna">Dyna</option>
                      <option value="Heavy Equipment">Heavy Equipment</option>
                    </select>
                  </FR>
                  {cf.driving_license_type && (
                    <>
                      <FR label="License Country"><input style={inp} value={cf.driving_license_country||""} onChange={e=>setCf(f=>({...f,driving_license_country:e.target.value}))} placeholder="Saudi Arabia, Pakistan…" /></FR>
                      <FR label="Status">
                        <select style={inp} value={cf.driving_license_status||""} onChange={e=>setCf(f=>({...f,driving_license_status:e.target.value}))}>
                          <option value="">—</option>
                          <option value="Valid">Valid</option>
                          <option value="Expired">Expired</option>
                        </select>
                      </FR>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FR label="CV File">
                  <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display:"none" }} onChange={handleCvUpload} />
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={btn({ fontSize:12, flex:1 })} onClick={()=>cvInputRef.current.click()} disabled={uploading}>
                      {cf.cv_url ? "Replace CV" : "Upload CV File"}
                    </button>
                    {cf.cv_url && <a href={cf.cv_url} target="_blank" rel="noreferrer" style={{ ...btn({ fontSize:12, color:"#4338CA", borderColor:"#C7D2FE" }), textDecoration:"none", display:"inline-flex", alignItems:"center" }}>View</a>}
                  </div>
                </FR>
              </div>
              <FR label="Work History (shown on Standard CV — e.g. 'XYZ Construction, Riyadh — Site Electrician, 2021-2023')" span><textarea style={{ ...inp, minHeight:70, resize:"vertical" }} value={cf.work_history||""} onChange={e=>setCf(f=>({...f,work_history:e.target.value}))} placeholder="Brief work history narrative — employer, role, duration" /></FR>
              <FR label="Key Skills" span><input style={inp} value={cf.skills||""} onChange={e=>setCf(f=>({...f,skills:e.target.value}))} placeholder="e.g. MIG/TIG welding, blueprint reading, forklift operation" /></FR>
              <FR label="Languages Spoken" span><input style={inp} value={cf.languages||""} onChange={e=>setCf(f=>({...f,languages:e.target.value}))} placeholder="e.g. Urdu (native), English (intermediate), Arabic (basic)" /></FR>
              <FR label="Additional Certifications (beyond trade test)" span><input style={inp} value={cf.additional_certifications||""} onChange={e=>setCf(f=>({...f,additional_certifications:e.target.value}))} placeholder="e.g. Forklift License, OSHA Safety Course, First Aid" /></FR>
              <FR label="Notes" span><textarea style={{ ...inp, minHeight:60, resize:"vertical" }} value={cf.databank_notes} onChange={e=>setCf(f=>({...f,databank_notes:e.target.value}))} /></FR>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16, paddingTop:14, borderTop:"1px solid #F3F4F6" }}>
                <button style={btn()} onClick={()=>setModal(false)}>Cancel</button>
                <button style={pri} onClick={saveCand}>{editId?"Save Changes":"Add to Databank"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
