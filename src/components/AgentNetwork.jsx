import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

const EMPTY_AGENT = { name: "", company_name: "", phone: "", whatsapp: "", country: "", city: "", notes: "" };
const EMPTY_INTERACTION = { interaction_type: "call", summary: "", outcome: "", next_followup_date: "", next_followup_notes: "" };

export default function AgentNetwork({ profile, jobs, addLog }) {
  const [agents, setAgents] = useState([]);
  const [candidateCounts, setCandidateCounts] = useState({}); // agent_id -> { total, databank, inProcess, deployed, last }
  const [lastContacted, setLastContacted] = useState({}); // agent_id -> most recent interaction_date
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_AGENT);
  const [saving, setSaving] = useState(false);
  const [detailAgent, setDetailAgent] = useState(null);
  const [detailCandidates, setDetailCandidates] = useState([]);
  const [detailInteractions, setDetailInteractions] = useState([]);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState(EMPTY_INTERACTION);

  // Daily post approval (#5)
  const [pendingPost, setPendingPost] = useState(null);
  const [postEditEn, setPostEditEn] = useState("");
  const [postEditUr, setPostEditUr] = useState("");
  const [postLanguage, setPostLanguage] = useState("en");
  const [generatingPost, setGeneratingPost] = useState(false);

  // Deployment notifications (#1)
  const [unnotifiedDeployments, setUnnotifiedDeployments] = useState([]);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Broadcast messaging
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [waLinks, setWaLinks] = useState(null);
  const fileInputRef = useRef(null);

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };
  const btn = (extra = {}) => ({ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", ...extra });
  const card = { background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB" };

  useEffect(() => { loadAgents(); }, [statusFilter]);
  useEffect(() => { loadPendingPost(); loadUnnotifiedDeployments(); }, []);

  async function loadPendingPost() {
    const { data } = await supabase.from("agent_posts").select("*").eq("status", "pending_approval").order("generated_at", { ascending: false }).limit(1).maybeSingle();
    setPendingPost(data || null);
    if (data) { setPostEditEn(data.content_en || ""); setPostEditUr(data.content_ur || ""); }
  }

  async function generateTodaysPost() {
    setGeneratingPost(true);
    const { error } = await supabase.functions.invoke("generate-agent-post", { body: {} });
    setGeneratingPost(false);
    if (error) { alert("Could not generate a post: " + error.message); return; }
    await loadPendingPost();
  }

  async function approveAndBroadcastPost() {
    if (!pendingPost) return;
    const content = postLanguage === "ur" ? postEditUr : postEditEn;
    if (!content.trim()) { alert("Message is empty."); return; }
    await supabase.from("agent_posts").update({
      content_en: postEditEn, content_ur: postEditUr, status: "approved", approved_by: profile.id, approved_at: new Date().toISOString(),
    }).eq("id", pendingPost.id);
    addLog(`Approved today's agent post (${postLanguage === "ur" ? "Urdu" : "English"})`);
    setMessage(content);
    setBroadcastOpen(true);
    setPendingPost(null);
  }

  async function rejectPost() {
    if (!pendingPost || !window.confirm("Reject today's draft? You can generate a new one after.")) return;
    await supabase.from("agent_posts").update({ status: "rejected", approved_by: profile.id, approved_at: new Date().toISOString() }).eq("id", pendingPost.id);
    addLog("Rejected today's auto-drafted agent post");
    setPendingPost(null);
  }

  async function loadUnnotifiedDeployments() {
    const { data } = await supabase.from("candidates").select("id, name, trade, agent_id, agents(name, whatsapp)").eq("stage", "deployed").eq("agent_notified_deployment", false).not("agent_id", "is", null);
    setUnnotifiedDeployments(data ?? []);
  }

  function notifyAgentOfDeployment(candidate) {
    if (!candidate.agents?.whatsapp) { alert(`${candidate.agents?.name || "This agent"} has no WhatsApp number on file.`); return; }
    const text = `Great news! Your candidate ${candidate.name} (${candidate.trade}) has been successfully deployed. Thank you for the great referral — please keep sending quality candidates our way! 🎉`;
    window.open(`https://wa.me/${candidate.agents.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
    supabase.from("candidates").update({ agent_notified_deployment: true }).eq("id", candidate.id).then(() => {
      addLog(`Notified agent ${candidate.agents.name} of ${candidate.name}'s deployment`);
      loadUnnotifiedDeployments();
    });
  }

  async function updateReliability(agent, rating) {
    await supabase.from("agents").update({ reliability_rating: rating }).eq("id", agent.id);
    addLog(`Set reliability rating for ${agent.name}: ${rating} star${rating !== 1 ? "s" : ""}`);
    loadAgents();
    if (detailAgent?.id === agent.id) setDetailAgent({ ...detailAgent, reliability_rating: rating });
  }

  async function loadAgents() {
    let query = supabase.from("agents").select("*").order("name");
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data: agentList } = await query;
    setAgents(agentList ?? []);

    const { data: cands } = await supabase.from("candidates").select("agent_id, stage, added_date").not("agent_id", "is", null);
    const counts = {};
    (cands ?? []).forEach(c => {
      if (!counts[c.agent_id]) counts[c.agent_id] = { total: 0, databank: 0, inProcess: 0, deployed: 0, last: null };
      counts[c.agent_id].total++;
      if (c.stage === "databank") counts[c.agent_id].databank++;
      else if (c.stage === "deployed") counts[c.agent_id].deployed++;
      else counts[c.agent_id].inProcess++;
      if (!counts[c.agent_id].last || c.added_date > counts[c.agent_id].last) counts[c.agent_id].last = c.added_date;
    });
    setCandidateCounts(counts);

    const { data: allInteractions } = await supabase.from("agent_interactions").select("agent_id, interaction_date").order("interaction_date", { ascending: false });
    const lastMap = {};
    (allInteractions ?? []).forEach(i => { if (!lastMap[i.agent_id]) lastMap[i.agent_id] = i.interaction_date; });
    setLastContacted(lastMap);
  }

  async function saveAgent(e) {
    e.preventDefault();
    if (!form.name.trim()) { alert("Agent name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("agents").insert({ ...form, created_by: profile.id });
    setSaving(false);
    if (error) { alert(error.message); return; }
    addLog(`Added agent to network: ${form.name}`);
    setForm(EMPTY_AGENT);
    setShowAddForm(false);
    loadAgents();
  }

  async function toggleAgentStatus(agent) {
    const newStatus = agent.status === "active" ? "inactive" : "active";
    await supabase.from("agents").update({ status: newStatus }).eq("id", agent.id);
    addLog(`Marked agent "${agent.name}" as ${newStatus}`);
    loadAgents();
  }

  function openEditAgent(agent) {
    setEditingAgent(agent.id);
    setEditForm({ name: agent.name, company_name: agent.company_name || "", phone: agent.phone || "", whatsapp: agent.whatsapp || "", country: agent.country || "", city: agent.city || "", notes: agent.notes || "" });
  }

  async function saveEditAgent() {
    await supabase.from("agents").update(editForm).eq("id", editingAgent);
    addLog(`Updated agent details: ${editForm.name}`);
    setEditingAgent(null);
    loadAgents();
  }

  async function openDetail(agent) {
    setDetailAgent(agent);
    const { data } = await supabase.from("candidates").select("id, name, trade, stage, added_date, job_id").eq("agent_id", agent.id).order("added_date", { ascending: false });
    setDetailCandidates(data ?? []);
    const { data: interactions } = await supabase.from("agent_interactions").select("*, team_members(full_name)").eq("agent_id", agent.id).order("interaction_date", { ascending: false });
    setDetailInteractions(interactions ?? []);
  }

  async function submitInteraction(e) {
    e.preventDefault();
    await supabase.from("agent_interactions").insert({
      agent_id: detailAgent.id, team_member_id: profile.id, ...interactionForm,
      next_followup_date: interactionForm.next_followup_date || null,
    });
    addLog(`Logged ${interactionForm.interaction_type} with agent: ${detailAgent.name}`);
    setInteractionForm(EMPTY_INTERACTION);
    setShowInteractionForm(false);
    openDetail(detailAgent);
    loadAgents();
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.filter(a => a.whatsapp).map(a => a.id)));
  }

  function insertActiveJobOrders() {
    const openJobs = (jobs || []).filter(j => j.status === "Open");
    if (openJobs.length === 0) { alert("No open job orders right now."); return; }
    const lines = openJobs.map(j => `▸ ${j.position} (${j.client}) — ${j.vacancies} vacancies, ${j.country}${j.salary ? `, SAR ${j.salary}` : ""}`).join("\n");
    setMessage(prev => `${prev ? prev + "\n\n" : ""}*Current Open Demands:*\n${lines}\n\nPlease send suitable candidates. Contact us for full details.`);
  }

  function handleAttachment(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentPreview({ name: file.name, url: URL.createObjectURL(file) });
  }

  function generateBroadcastLinks() {
    if (!message.trim()) { alert("Write a message first."); return; }
    const targets = agents.filter(a => selectedIds.has(a.id) && a.whatsapp);
    if (targets.length === 0) { alert("Select at least one agent with a WhatsApp number on file."); return; }
    const links = targets.map(a => ({
      id: a.id, name: a.name,
      url: `https://wa.me/${a.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
    }));
    setWaLinks(links);
    addLog(`Prepared WhatsApp broadcast to ${links.length} agent(s)${attachmentPreview ? " with image attachment" : ""}`);
  }

  const filtered = agents.filter(a =>
    `${a.name} ${a.company_name || ""} ${a.country || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const STAGE_LABEL_MAP = { databank: "In Databank", deployed: "Deployed" };

  return (
    <div>
      <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#92400E" }}>🤝 Agent Network</div>
        <div style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>
          Performance tracking covers everything since this system went live — candidates linked to an agent here count toward their real record.
        </div>
      </div>

      {!detailAgent && pendingPost && (
        <div style={{ ...card, border: "2px solid #6366F1", marginBottom: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#3730A3" }}>📝 Today's Agent Post — Awaiting Your Approval</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPostLanguage("en")} style={{ ...btn({ padding: "4px 10px", fontSize: 11 }), background: postLanguage === "en" ? "#EEF2FF" : "#fff", color: postLanguage === "en" ? "#4338CA" : "#6B7280" }}>English</button>
              <button onClick={() => setPostLanguage("ur")} style={{ ...btn({ padding: "4px 10px", fontSize: 11 }), background: postLanguage === "ur" ? "#EEF2FF" : "#fff", color: postLanguage === "ur" ? "#4338CA" : "#6B7280" }}>اردو</button>
            </div>
          </div>
          <textarea
            style={{ ...inp, minHeight: 90, direction: postLanguage === "ur" ? "rtl" : "ltr", fontFamily: postLanguage === "ur" ? "'Noto Nastaliq Urdu', serif" : "inherit" }}
            value={postLanguage === "ur" ? postEditUr : postEditEn}
            onChange={e => postLanguage === "ur" ? setPostEditUr(e.target.value) : setPostEditEn(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn({ background: "#10B981", color: "#fff", border: "none", flex: 1 })} onClick={approveAndBroadcastPost}>✓ Approve &amp; Broadcast to Agents</button>
            <button style={btn({ flex: 1 })} onClick={rejectPost}>✕ Reject</button>
          </div>
        </div>
      )}

      {!detailAgent && !pendingPost && (
        <button style={{ ...btn({ fontSize: 12 }), marginBottom: 16 }} onClick={generateTodaysPost} disabled={generatingPost}>
          {generatingPost ? "Generating…" : "✨ Generate Today's Agent Post"}
        </button>
      )}

      {!detailAgent && unnotifiedDeployments.length > 0 && (
        <div style={{ ...card, border: "1px solid #A7F3D0", background: "#ECFDF5", marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", marginBottom: 8 }}>🎉 Deployed Candidates — Thank Their Agent</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unnotifiedDeployments.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <span><b>{c.name}</b> ({c.trade}) — sourced by {c.agents?.name}</span>
                <button style={btn({ padding: "4px 10px", fontSize: 11, background: "#10B981", color: "#fff", border: "none" })} onClick={() => notifyAgentOfDeployment(c)}>💬 Notify Agent</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!detailAgent && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...inp, maxWidth: 240, marginBottom: 0 }} placeholder="Search agents…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...inp, width: "auto", marginBottom: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {selectedIds.size > 0 && (
                <button style={btn({ background: "#10B981", color: "#fff", border: "none" })} onClick={() => setBroadcastOpen(true)}>
                  💬 Message {selectedIds.size} Selected
                </button>
              )}
              <button style={btn({ background: "#111827", color: "#fff", border: "none" })} onClick={() => setShowAddForm(s => !s)}>
                {showAddForm ? "Cancel" : "+ Add Agent"}
              </button>
            </div>
          </div>

          {showAddForm && (
            <form onSubmit={saveAgent} style={{ ...card, padding: 16, marginBottom: 16, background: "#F9FAFB" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input style={inp} placeholder="Agent name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input style={inp} placeholder="Company / Agency name" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                <input style={inp} placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input style={inp} placeholder="WhatsApp (with country code, e.g. 923001234567)" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                <input style={inp} placeholder="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                <input style={inp} placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <textarea style={{ ...inp, minHeight: 50 }} placeholder="Notes (specialty, reliability, anything worth flagging)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <button type="submit" disabled={saving} style={btn({ background: "#111827", color: "#fff", border: "none" })}>{saving ? "Saving…" : "Save Agent"}</button>
            </form>
          )}

          {selectedIds.size === 0 && filtered.some(a => a.whatsapp) && (
            <button style={{ ...btn({ fontSize: 12 }), marginBottom: 12 }} onClick={selectAllVisible}>☑ Select All Visible (with WhatsApp)</button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(agent => {
              const stats = candidateCounts[agent.id] || { total: 0, databank: 0, inProcess: 0, deployed: 0, last: null };
              const lastContactDate = lastContacted[agent.id];
              const daysSinceContact = lastContactDate ? Math.floor((Date.now() - new Date(lastContactDate).getTime()) / 86400000) : null;
              const contactColor = daysSinceContact === null ? "#9CA3AF" : daysSinceContact <= 7 ? "#10B981" : daysSinceContact <= 21 ? "#F59E0B" : "#EF4444";
              return (
                <div key={agent.id} style={{ ...card, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <input type="checkbox" checked={selectedIds.has(agent.id)} onChange={() => toggleSelect(agent.id)} disabled={!agent.whatsapp} title={!agent.whatsapp ? "No WhatsApp number on file" : ""} style={{ marginTop: 4 }} />
                      <div style={{ cursor: "pointer" }} onClick={() => openDetail(agent)}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{agent.company_name} {agent.city && `· ${agent.city}`} {agent.country && `, ${agent.country}`}</div>
                        <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "#374151" }}>{stats.total} total candidates</span>
                          {stats.databank > 0 && <span style={{ color: "#9CA3AF" }}>{stats.databank} in databank</span>}
                          {stats.inProcess > 0 && <span style={{ color: "#D97706" }}>{stats.inProcess} in process</span>}
                          {stats.deployed > 0 && <span style={{ color: "#059669", fontWeight: 600 }}>✓ {stats.deployed} deployed</span>}
                          {stats.last && <span style={{ color: "#9CA3AF" }}>· last submitted {stats.last}</span>}
                          {profile.role === "admin" && agent.reliability_rating && (
                            <span style={{ color: "#F59E0B" }}>{"★".repeat(agent.reliability_rating)}{"☆".repeat(5 - agent.reliability_rating)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: agent.status === "active" ? "#D1FAE5" : "#F3F4F6", color: agent.status === "active" ? "#065F46" : "#6B7280" }}>{agent.status}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: contactColor }}>
                        {daysSinceContact === null ? "Never contacted" : daysSinceContact === 0 ? "Contacted today" : `Contacted ${daysSinceContact}d ago`}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={btn({ padding: "3px 8px", fontSize: 10 })} onClick={() => openEditAgent(agent)}>Edit</button>
                        <button style={btn({ padding: "3px 8px", fontSize: 10 })} onClick={() => toggleAgentStatus(agent)}>{agent.status === "active" ? "Deactivate" : "Activate"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", padding: 30, fontSize: 13 }}>No agents yet. Click "+ Add Agent" to start building your network.</div>}
          </div>
        </>
      )}

      {/* ══ AGENT DETAIL VIEW ══ */}
      {detailAgent && (
        <div>
          <button style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 14 }} onClick={() => setDetailAgent(null)}>← Back to all agents</button>

          <div style={{ ...card, padding: 18, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{detailAgent.name}</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{detailAgent.company_name} {detailAgent.city && `· ${detailAgent.city}`} {detailAgent.country && `, ${detailAgent.country}`}</div>
                {detailAgent.notes && <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 10px", marginTop: 10 }}>{detailAgent.notes}</div>}
                {profile.role === "admin" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Internal reliability (admin only):</span>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} onClick={() => updateReliability(detailAgent, n)} style={{ cursor: "pointer", fontSize: 16, color: (detailAgent.reliability_rating || 0) >= n ? "#F59E0B" : "#E5E7EB" }}>★</span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#4338CA", fontWeight: 600, marginBottom: 4 }}>📎 {detailAgent.name}'s Personal CV Submission Link</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <code style={{ fontSize: 12, color: "#1E1B4B", background: "#fff", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 8px", flex: 1, overflowX: "auto", whiteSpace: "nowrap" }}>
                      apply.riverside.com.pk/?ref={detailAgent.referral_slug || detailAgent.referral_code}
                    </code>
                    <button
                      style={btn({ padding: "5px 10px", fontSize: 11 })}
                      onClick={() => { navigator.clipboard.writeText(`https://apply.riverside.com.pk/?ref=${detailAgent.referral_slug || detailAgent.referral_code}`); alert("Link copied — share it with this agent on WhatsApp."); }}
                    >Copy Link</button>
                  </div>

                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12 }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://apply.riverside.com.pk/?ref=${detailAgent.referral_slug || detailAgent.referral_code}`)}`}
                      alt="QR code for submission link"
                      style={{ width: 110, height: 110, borderRadius: 8, border: "1px solid #C7D2FE", background: "#fff" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#4338CA", fontWeight: 600, marginBottom: 6 }}>📷 QR Code</div>
                      <div style={{ fontSize: 10, color: "#6366F1", marginBottom: 8 }}>The agent can save this image on their phone. Whenever they have a candidate's CV ready, they just scan it — opens straight to their personal submission page.</div>
                      <a
                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`https://apply.riverside.com.pk/?ref=${detailAgent.referral_slug || detailAgent.referral_code}`)}`}
                        download={`${detailAgent.name.replace(/\s+/g, "_")}_QR_Code.png`}
                        target="_blank" rel="noreferrer"
                        style={{ ...btn({ padding: "5px 10px", fontSize: 11 }), textDecoration: "none", display: "inline-block" }}
                      >⬇ Download QR Image</a>
                    </div>
                  </div>

                  <div style={{ fontSize: 10, color: "#6366F1", marginTop: 10 }}>Any CV submitted through this link or QR code is automatically credited to {detailAgent.name} — no manual entry needed.</div>
                </div>
              </div>
              {detailAgent.whatsapp && (
                <button style={btn({ background: "#10B981", color: "#fff", border: "none" })} onClick={() => { setSelectedIds(new Set([detailAgent.id])); setDetailAgent(null); setBroadcastOpen(true); }}>
                  💬 Message
                </button>
              )}
            </div>
          </div>

          <button onClick={() => setShowInteractionForm(s => !s)} style={{ width: "100%", background: showInteractionForm ? "#fff" : "#111827", color: showInteractionForm ? "#374151" : "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
            {showInteractionForm ? "Cancel" : "+ Log Contact / Interaction"}
          </button>

          {showInteractionForm && (
            <form onSubmit={submitInteraction} style={{ ...card, padding: 16, marginBottom: 16, background: "#F9FAFB" }}>
              <select value={interactionForm.interaction_type} onChange={e => setInteractionForm(f => ({ ...f, interaction_type: e.target.value }))} style={inp}>
                <option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option><option value="visit">In-person visit</option><option value="other">Other</option>
              </select>
              <textarea placeholder="What was discussed (e.g. updated on open positions, asked for 5 electricians)" value={interactionForm.summary} onChange={e => setInteractionForm(f => ({ ...f, summary: e.target.value }))} style={{ ...inp, minHeight: 50 }} />
              <input placeholder="Outcome (e.g. agreed to send candidates by Friday)" value={interactionForm.outcome} onChange={e => setInteractionForm(f => ({ ...f, outcome: e.target.value }))} style={inp} />
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Next follow-up date (optional)</div>
              <input type="date" value={interactionForm.next_followup_date} onChange={e => setInteractionForm(f => ({ ...f, next_followup_date: e.target.value }))} style={inp} />
              <button type="submit" style={btn({ background: "#10B981", color: "#fff", border: "none", width: "100%" })}>Save</button>
            </form>
          )}

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Contact History ({detailInteractions.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {detailInteractions.map(i => (
              <div key={i.id} style={{ ...card, padding: "10px 14px", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#9CA3AF", marginBottom: 4 }}>
                  <span style={{ textTransform: "capitalize" }}>{i.interaction_type} · {i.team_members?.full_name || "Unknown"}</span>
                  <span>{new Date(i.interaction_date).toLocaleDateString()}</span>
                </div>
                {i.summary && <div style={{ color: "#374151" }}>{i.summary}</div>}
                {i.outcome && <div style={{ color: "#059669", marginTop: 4 }}><b>Outcome:</b> {i.outcome}</div>}
                {i.next_followup_date && <div style={{ color: "#3B82F6", fontSize: 11, marginTop: 4 }}>Next follow-up: {i.next_followup_date}</div>}
              </div>
            ))}
            {detailInteractions.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 16 }}>No contact logged yet.</div>}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Candidates Sourced ({detailCandidates.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detailCandidates.map(c => (
              <div key={c.id} style={{ ...card, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{c.trade}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.stage === "deployed" ? "#059669" : "#6B7280" }}>{STAGE_LABEL_MAP[c.stage] || c.stage}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{c.added_date}</div>
                </div>
              </div>
            ))}
            {detailCandidates.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 20 }}>No candidates linked to this agent yet.</div>}
          </div>
        </div>
      )}

      {/* ══ EDIT AGENT MODAL ══ */}
      {editingAgent && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && setEditingAgent(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: 480, maxHeight: "85vh", overflowY: "auto", padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Edit Agent</div>
            <input style={inp} placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <input style={inp} placeholder="Company" value={editForm.company_name} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
            <input style={inp} placeholder="Phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            <input style={inp} placeholder="WhatsApp" value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} />
            <input style={inp} placeholder="Country" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
            <input style={inp} placeholder="City" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
            <textarea style={{ ...inp, minHeight: 50 }} placeholder="Notes" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button style={btn()} onClick={() => setEditingAgent(null)}>Cancel</button>
              <button style={btn({ background: "#111827", color: "#fff", border: "none" })} onClick={saveEditAgent}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BROADCAST / MESSAGE MODAL ══ */}
      {broadcastOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setBroadcastOpen(false)}>
          <div style={{ background: "#fff", borderRadius: 16, width: 560, maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Message {selectedIds.size} Agent{selectedIds.size !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Generates a WhatsApp link per agent with your message pre-filled. Click each to open and send.</div>

            <button style={{ ...btn({ fontSize: 12, marginBottom: 10 }) }} onClick={insertActiveJobOrders}>📋 Insert Current Open Job Orders</button>

            <textarea style={{ ...inp, minHeight: 130 }} placeholder="Write your message or announcement…" value={message} onChange={e => setMessage(e.target.value)} />

            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAttachment} />
            {attachmentPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: 8 }}>
                <img src={attachmentPreview.url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                <span style={{ fontSize: 12, color: "#065F46", flex: 1 }}>{attachmentPreview.name}</span>
                <button style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 12 }} onClick={() => setAttachmentPreview(null)}>Remove</button>
              </div>
            ) : (
              <button style={{ ...btn({ fontSize: 12, marginBottom: 10 }) }} onClick={() => fileInputRef.current.click()}>📎 Attach Image (poster / advert)</button>
            )}
            {attachmentPreview && (
              <div style={{ fontSize: 11, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: 8, marginBottom: 10 }}>
                WhatsApp links can't auto-attach images. Save this image to your phone first, then attach it manually in each WhatsApp chat alongside the pre-filled message.
              </div>
            )}

            <button style={btn({ background: "#10B981", color: "#fff", border: "none", width: "100%" })} onClick={generateBroadcastLinks}>💬 Generate WhatsApp Links</button>

            {waLinks && (
              <div style={{ marginTop: 14, border: "1px solid #A7F3D0", borderRadius: 10, padding: 12, background: "#ECFDF5" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", marginBottom: 8 }}>{waLinks.length} link{waLinks.length !== 1 ? "s" : ""} ready</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {waLinks.map(l => (
                    <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", background: "#fff", border: "1px solid #A7F3D0", borderRadius: 8, padding: "8px 12px", fontSize: 12, textDecoration: "none", color: "#111827" }}>
                      <span>{l.name}</span><span style={{ color: "#10B981", fontWeight: 600 }}>Open chat →</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button style={btn()} onClick={() => { setBroadcastOpen(false); setWaLinks(null); setMessage(""); setAttachmentPreview(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
