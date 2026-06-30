import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function CvBulkImport({ profile, jobs, onRefresh, addLog }) {
  const [batches, setBatches] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef(null);

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };
  const btn = (extra = {}) => ({ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", ...extra });

  useEffect(() => { loadBatches(); }, []);
  useEffect(() => { if (activeBatch) loadItems(activeBatch.id); }, [activeBatch?.id]);

  async function loadBatches() {
    const { data } = await supabase.from("cv_import_batches").select("*").order("created_at", { ascending: false });
    setBatches(data ?? []);
  }

  async function loadItems(batchId) {
    const { data } = await supabase.from("cv_import_items").select("*").eq("batch_id", batchId).order("file_name");
    setItems(data ?? []);
    // pre-select all high-confidence real CVs
    const preselect = new Set((data ?? []).filter(i => i.extraction_status === "processed").map(i => i.id));
    setSelectedIds(preselect);
  }

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);

    const batchName = `Batch ${new Date().toLocaleDateString("en-GB")} (${files.length} files)`;
    const { data: batch, error: batchErr } = await supabase.from("cv_import_batches")
      .insert({ batch_name: batchName, total_files: files.length, status: "uploading", created_by: profile.id })
      .select().single();
    if (batchErr) { alert(batchErr.message); setUploading(false); return; }

    let uploaded = 0;
    for (const file of files) {
      const path = `${batch.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("cv-bulk-import").upload(path, file);
      if (!upErr) {
        await supabase.from("cv_import_items").insert({
          batch_id: batch.id, file_name: file.name, storage_path: path, mime_type: file.type,
        });
        uploaded++;
      }
      setProgress({ done: uploaded, total: files.length });
    }

    await supabase.from("cv_import_batches").update({ status: "processing" }).eq("id", batch.id);
    setUploading(false);
    setProgress({ done: 0, total: 0 });
    loadBatches();
    setActiveBatch(batch);
    addLog(`Uploaded ${uploaded} CVs for bulk extraction (${batchName})`);
  }

  async function processBatch() {
    if (!activeBatch) return;
    setProcessing(true);
    const { data: pendingItems } = await supabase.from("cv_import_items").select("id").eq("batch_id", activeBatch.id).eq("extraction_status", "pending");
    const list = pendingItems ?? [];
    setProgress({ done: 0, total: list.length });

    // Anthropic's default rate limit for new accounts is low (e.g. 5 requests/minute).
    // Space requests out to stay safely under that, and back off further if we still get rate-limited.
    let delayMs = 13000; // ~4.6/minute, safely under a 5/minute cap

    for (let i = 0; i < list.length; i++) {
      let attempt = 0;
      let success = false;
      while (!success && attempt < 6) {
        attempt++;
        try {
          const { data, error } = await supabase.functions.invoke("extract-cv", { body: { item_id: list[i].id } });
          if (!error && !data?.retryable) {
            success = true;
          } else if (data?.retryable || error?.message?.includes("429")) {
            // Rate limited — wait longer than usual before retrying this same file
            await new Promise(r => setTimeout(r, 65000));
          } else {
            success = true; // a real (non-rate-limit) error was already recorded on the item row — move on
          }
        } catch {
          await new Promise(r => setTimeout(r, 65000));
        }
      }
      setProgress({ done: i + 1, total: list.length });
      await loadItems(activeBatch.id); // live-refresh so user sees results streaming in
      if (i < list.length - 1) await new Promise(r => setTimeout(r, delayMs));
    }

    await supabase.from("cv_import_batches").update({ status: "review", processed_count: list.length }).eq("id", activeBatch.id);
    setProcessing(false);
    loadBatches();
    loadItems(activeBatch.id);
  }

  async function retryFailedItems() {
    if (!activeBatch) return;
    await supabase.from("cv_import_items").update({ extraction_status: "pending", review_reason: null }).eq("batch_id", activeBatch.id).eq("extraction_status", "error");
    await loadItems(activeBatch.id);
    processBatch();
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function openEdit(item) {
    setEditingItem(item.id);
    setEditForm({ ...item.extracted_data });
  }

  async function saveEdit() {
    await supabase.from("cv_import_items").update({ extracted_data: editForm }).eq("id", editingItem);
    setEditingItem(null);
    loadItems(activeBatch.id);
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.file_name}"? This removes the file permanently and cannot be undone.`)) return;
    await supabase.storage.from("cv-bulk-import").remove([item.storage_path]);
    await supabase.from("cv_import_items").delete().eq("id", item.id);
    setSelectedIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    loadItems(activeBatch.id);
  }

  async function deleteAllNeedsReview() {
    const reviewItems = items.filter(i => i.extraction_status === "needs_review");
    if (reviewItems.length === 0) return;
    if (!window.confirm(`Delete all ${reviewItems.length} "needs review" files? This cannot be undone.`)) return;
    for (const item of reviewItems) {
      await supabase.storage.from("cv-bulk-import").remove([item.storage_path]);
      await supabase.from("cv_import_items").delete().eq("id", item.id);
    }
    loadItems(activeBatch.id);
  }

  async function addSelectedToDatabank() {
    if (selectedIds.size === 0) { alert("Select at least one CV to add."); return; }
    setAdding(true);
    let added = 0, skipped = 0, failed = 0, firstError = null;

    for (const id of selectedIds) {
      const item = items.find(i => i.id === id);
      if (!item || !item.extracted_data) continue;
      const d = item.extracted_data;

      // dedupe by CNIC if present
      if (d.cnic) {
        const { data: existing } = await supabase.from("candidates").select("id").eq("cnic", d.cnic).limit(1);
        if (existing && existing.length > 0) {
          await supabase.from("cv_import_items").update({ extraction_status: "duplicate" }).eq("id", id);
          skipped++;
          continue;
        }
      }

      const { data: urlData } = supabase.storage.from("cv-bulk-import").getPublicUrl(item.storage_path);

      const payload = {
        name: d.name || item.file_name.replace(/\.[^.]+$/, ""),
        father_name: d.father_name || null,
        cnic: d.cnic || null,
        phone: d.phone || null,
        email: d.email || null,
        trade: d.trade || null,
        experience: d.experience || null,
        education: d.education || null,
        nationality: d.nationality || "Pakistani",
        passport: d.passport || null,
        passport_expiry: d.passport_expiry || null,
        date_of_birth: d.date_of_birth || null,
        marital_status: d.marital_status || null,
        has_gcc_experience: !!d.has_gcc_experience,
        gcc_countries: d.gcc_countries || null,
        gcc_experience_years: d.gcc_experience_years || null,
        driving_license_type: d.driving_license_type || null,
        driving_license_country: d.driving_license_country || null,
        driving_license_status: d.driving_license_status || null,
        work_history: d.work_history || null,
        skills: d.skills || null,
        languages: d.languages || null,
        additional_certifications: d.additional_certifications || null,
        cv_url: urlData.publicUrl,
        stage: "databank",
        source: `Bulk Import (${activeBatch.batch_name})`,
        created_by: profile.id,
      };

      const { data: newCand, error } = await supabase.from("candidates").insert([payload]).select().single();
      if (!error && newCand) {
        await supabase.from("cv_import_items").update({ added_to_databank: true, candidate_id: newCand.id }).eq("id", id);
        added++;
      } else if (error) {
        failed++;
        if (!firstError) firstError = error.message;
      }
    }

    setAdding(false);
    setSelectedIds(new Set());
    addLog(`Bulk import: added ${added} candidates to databank${skipped ? `, skipped ${skipped} duplicates` : ""}${failed ? `, ${failed} failed` : ""}`);
    let summary = `Done. ${added} candidates added to your CV Databank.`;
    if (skipped) summary += ` ${skipped} skipped as duplicates (matching CNIC already exists).`;
    if (failed) summary += ` ${failed} failed to save — error: ${firstError}`;
    alert(summary);
    onRefresh();
    loadItems(activeBatch.id);
  }

  const STATUS_LABELS = {
    pending: { label: "Pending", color: "#9CA3AF", bg: "#F3F4F6" },
    processed: { label: "✓ Ready", color: "#065F46", bg: "#D1FAE5" },
    needs_review: { label: "⚠ Needs Review", color: "#92400E", bg: "#FEF3C7" },
    unsupported: { label: "⊘ Unsupported", color: "#6B7280", bg: "#F3F4F6" },
    error: { label: "✕ Error", color: "#991B1B", bg: "#FEE2E2" },
    duplicate: { label: "⎘ Duplicate", color: "#6B7280", bg: "#F3F4F6" },
  };

  const readyCount = items.filter(i => i.extraction_status === "processed").length;
  const reviewCount = items.filter(i => i.extraction_status === "needs_review").length;
  const otherCount = items.filter(i => ["unsupported", "error", "duplicate"].includes(i.extraction_status)).length;
  const pendingCount = items.filter(i => i.extraction_status === "pending").length;

  return (
    <div>
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#3730A3" }}>🤖 Bulk CV Import (AI-Assisted)</div>
        <div style={{ fontSize: 12, color: "#4338CA", marginTop: 2 }}>Upload a folder of CVs at once. Claude reads each file and extracts structured candidate data automatically. Review before adding to your databank.</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png,.htm,.html" style={{ display: "none" }} onChange={handleFilesSelected} />
        <button style={btn({ background: "#111827", color: "#fff", border: "none" })} onClick={() => fileInputRef.current.click()} disabled={uploading}>
          {uploading ? `Uploading… (${progress.done}/${progress.total})` : "📁 Select CV Files / Folder to Upload"}
        </button>
      </div>

      {batches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>IMPORT BATCHES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {batches.map(b => (
              <button key={b.id} onClick={() => setActiveBatch(b)}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: activeBatch?.id === b.id ? "2px solid #6366F1" : "1px solid #E5E7EB", background: activeBatch?.id === b.id ? "#EEF2FF" : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.batch_name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{b.total_files} files · status: {b.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeBatch && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            {pendingCount > 0 && (
              <button style={btn({ background: "#10B981", color: "#fff", border: "none" })} onClick={processBatch} disabled={processing}>
                {processing ? `Processing… (${progress.done}/${progress.total})` : `🤖 Process ${pendingCount} CV${pendingCount !== 1 ? "s" : ""} with AI`}
              </button>
            )}
            {items.some(i => i.extraction_status === "error") && (
              <button style={btn({ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" })} onClick={retryFailedItems} disabled={processing}>
                🔁 Retry Failed Items
              </button>
            )}
            {reviewCount > 0 && (
              <button style={btn({ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA" })} onClick={deleteAllNeedsReview}>
                🗑 Delete All "Needs Review" ({reviewCount})
              </button>
            )}
            <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ {readyCount} ready</span>
            <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>⚠ {reviewCount} need review</span>
            <span style={{ fontSize: 12, color: "#6B7280" }}>{otherCount} other</span>
            {pendingCount > 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{pendingCount} pending</span>}
          </div>
          {processing && (
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
              Processing carefully to stay within your account's request rate limit — roughly 1 CV every 13 seconds. This is normal and speeds up automatically as your account's limits increase with usage. You can leave this tab open and check back later.
            </div>
          )}

          {(readyCount > 0 || reviewCount > 0) && (
            <button style={btn({ background: "#0B2545", color: "#fff", border: "none", marginBottom: 16 })} onClick={addSelectedToDatabank} disabled={adding}>
              {adding ? "Adding…" : `➕ Add ${selectedIds.size} Selected to CV Databank`}
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => {
              const status = item.added_to_databank
                ? { label: "✓ Added", color: "#fff", bg: "#10B981" }
                : (STATUS_LABELS[item.extraction_status] || STATUS_LABELS.pending);
              const d = item.extracted_data;
              const canSelect = item.extraction_status === "processed" || item.extraction_status === "needs_review";
              return (
                <div key={item.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                      {canSelect && !item.added_to_databank && (
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ marginTop: 3 }} />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#9CA3AF", wordBreak: "break-word" }}>{item.file_name}</div>
                        {d?.name && <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name} {d.trade && <span style={{ fontWeight: 400, color: "#6B7280" }}>· {d.trade}</span>}</div>}
                        {item.review_reason && <div style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>{item.review_reason}</div>}
                        {item.added_to_databank && <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginTop: 2 }}>✓ Added to databank</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, color: status.color, background: status.bg }}>{status.label}</span>
                      {d && !item.added_to_databank && <button style={btn({ padding: "4px 9px", fontSize: 11 })} onClick={() => openEdit(item)}>Review / Edit</button>}
                      {!item.added_to_databank && <button style={btn({ padding: "4px 9px", fontSize: 11, color: "#EF4444", borderColor: "#FEE2E2" })} onClick={() => deleteItem(item)}>🗑 Delete</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingItem && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setEditingItem(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: 600, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #F3F4F6", position: "sticky", top: 0, background: "#fff" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Review Extracted Data</span>
              <button style={btn({ padding: "4px 10px" })} onClick={() => setEditingItem(null)}>✕</button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["name", "father_name", "cnic", "phone", "email", "trade", "experience", "education", "nationality", "passport", "passport_expiry", "date_of_birth", "marital_status", "gcc_countries", "gcc_experience_years", "driving_license_type", "driving_license_country", "driving_license_status", "skills", "languages", "additional_certifications"].map(field => (
                  <div key={field}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>{field.replace(/_/g, " ")}</div>
                    <input style={inp} value={editForm[field] || ""} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>Work History</div>
                <textarea style={{ ...inp, minHeight: 70 }} value={editForm.work_history || ""} onChange={e => setEditForm(f => ({ ...f, work_history: e.target.value }))} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={!!editForm.has_gcc_experience} onChange={e => setEditForm(f => ({ ...f, has_gcc_experience: e.target.checked }))} />
                Has GCC/Foreign Experience
              </label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
                <button style={btn()} onClick={() => setEditingItem(null)}>Cancel</button>
                <button style={btn({ background: "#0B2545", color: "#fff", border: "none" })} onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
