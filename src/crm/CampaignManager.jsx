import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const TYPES = [
  { value: 'past_client_revival', label: "We're in the market (past clients)" },
  { value: 'potential_outreach', label: 'Prospect outreach' },
  { value: 'informational', label: 'Informational / newsletter' },
  { value: 'opportunity_alert', label: 'New opportunity alert' },
];

const EMPTY_FORM = {
  name: '', campaign_type: 'informational', channel: 'email', subject: '', body_html: '',
  target_mode: 'type', target_client_type: 'all', target_sector: '',
  target_list_id: '', target_client_ids: [], scheduled_at: '',
  cc_senior_management: true, attachment_url: '', attachment_name: '',
};

export default function CampaignManager({ currentUser }) {
  const [campaigns, setCampaigns] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [manualSearch, setManualSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [waLinks, setWaLinks] = useState(null); // generated whatsapp links for the active campaign
  const [generating, setGenerating] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const attachmentInputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => { load(); loadLists(); loadClients(); }, []);

  async function load() {
    const { data } = await supabase.from('campaigns').select('*, client_lists(name)').order('created_at', { ascending: false });
    setCampaigns(data ?? []);
  }

  async function loadLists() {
    const { data } = await supabase.from('client_lists').select('id, name').order('name');
    setCustomLists(data ?? []);
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id, company_name, contact_person, client_type, sector, whatsapp, email').order('company_name');
    setAllClients(data ?? []);
  }

  function toggleManualClient(id) {
    setForm((f) => ({
      ...f,
      target_client_ids: f.target_client_ids.includes(id)
        ? f.target_client_ids.filter((x) => x !== id)
        : [...f.target_client_ids, id],
    }));
  }

  // Resolve which clients a campaign's targeting settings actually point to (used for WhatsApp link generation & future sends)
  async function resolveRecipients(cfg) {
    if (cfg.target_mode === 'manual') {
      return allClients.filter((c) => cfg.target_client_ids.includes(c.id));
    }
    if (cfg.target_mode === 'list') {
      if (!cfg.target_list_id) return [];
      const { data: members } = await supabase.from('client_list_members').select('client_id').eq('list_id', cfg.target_list_id);
      const ids = new Set((members ?? []).map((m) => m.client_id));
      return allClients.filter((c) => ids.has(c.id));
    }
    // 'type' mode
    return allClients.filter((c) => {
      const matchesType = cfg.target_client_type === 'all' || c.client_type === cfg.target_client_type;
      const matchesSector = !cfg.target_sector || (c.sector || '').toLowerCase().includes(cfg.target_sector.toLowerCase());
      return matchesType && matchesSector;
    });
  }

  function personalize(template, client) {
    return (template || '')
      .replace(/{{\s*contact_person\s*}}/gi, client.contact_person || 'there')
      .replace(/{{\s*company_name\s*}}/gi, client.company_name || '');
  }

  async function saveCampaign(status) {
    if (!form.name.trim()) { alert('Campaign name is required'); return; }
    const { data, error } = await supabase.from('campaigns').insert({
      ...form, status, created_by: currentUser.id,
      scheduled_at: form.scheduled_at || new Date().toISOString(),
    }).select().single();
    if (error) { alert(error.message); return; }
    setForm(EMPTY_FORM);
    setWaLinks(null);
    load();
    return data;
  }

  async function handleAttachmentUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAttachment(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await supabase.storage.from('campaign-attachments').upload(path, file);
    setUploadingAttachment(false);
    if (error) { alert('Upload failed: ' + error.message); return; }
    const { data } = supabase.storage.from('campaign-attachments').getPublicUrl(path);
    setForm((f) => ({ ...f, attachment_url: data.publicUrl, attachment_name: file.name }));
  }

  // Wraps the selected text in the textarea with formatting markup.
  // Email uses real HTML tags; WhatsApp uses its own markdown-style markup.
  function applyFormat(type) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end) || (type === 'link' ? 'link text' : 'text');
    let wrapped;
    if (form.channel === 'whatsapp') {
      wrapped = type === 'bold' ? `*${selected}*` : type === 'italic' ? `_${selected}_` : type === 'strike' ? `~${selected}~` : selected;
    } else {
      wrapped = type === 'bold' ? `<b>${selected}</b>` : type === 'italic' ? `<i>${selected}</i>` : type === 'link' ? `<a href="https://">${selected}</a>` : selected;
    }
    const newValue = value.slice(0, start) + wrapped + value.slice(end);
    setForm((f) => ({ ...f, body_html: newValue }));
    setTimeout(() => { el.focus(); el.selectionStart = start; el.selectionEnd = start + wrapped.length; }, 0);
  }

  // Mirrors the formatting logic in the send-campaign Edge Function exactly,
  // so the preview shown here matches what the client will actually receive.
  function formatBodyAsHtml(rawBody) {
    const lines = (rawBody || '').split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('•')) {
        const segments = trimmed.split('•').map(s => s.trim()).filter(Boolean);
        const intro = !trimmed.startsWith('•') ? segments.shift() : null;
        if (inList) { html += '</ul>'; inList = false; }
        if (intro) html += `<p style="margin:0 0 6px 0;font-weight:bold;">${intro}</p>`;
        if (segments.length > 0) {
          html += '<ul style="margin:8px 0;padding-left:20px;">';
          segments.forEach(seg => { html += `<li style="margin-bottom:4px;">${seg}</li>`; });
          html += '</ul>';
        }
        continue;
      }

      const isBullet = /^[•\-*]\s+/.test(trimmed);
      if (isBullet) {
        if (!inList) { html += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
        html += `<li style="margin-bottom:4px;">${trimmed.replace(/^[•\-*]\s+/, '')}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += trimmed === '' ? '<br>' : `<p style="margin:0 0 10px 0;">${trimmed}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function wrapInBrandedTemplate(bodyHtml) {
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#F4F6F8;">
  <div style="background:#0B2545;padding:24px 28px;">
    <div style="color:#D4A017;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">
      Government Licensed &middot; Overseas Employment Promoters
    </div>
    <div style="color:#ffffff;font-size:20px;font-weight:bold;">Riverside Enterprises</div>
    <div style="color:#9FB3C8;font-size:12px;margin-top:2px;">Recruitment Consultants &middot; Lahore, Pakistan</div>
  </div>
  <div style="background:#ffffff;padding:28px;color:#1F2937;font-size:14px;line-height:1.6;">
    ${bodyHtml}
  </div>
  <div style="background:#0B2545;padding:16px 28px;text-align:center;">
    <div style="color:#9FB3C8;font-size:11px;">
      Riverside Enterprises Recruitment Consultants, Lahore, Pakistan<br>
      This email was sent to you because of an existing business relationship with Riverside Enterprises.
    </div>
  </div>
</div>`.trim();
  }

  function showPreview() {
    if (!form.body_html.trim()) { alert('Write your message first.'); return; }
    const sampleClient = { contact_person: 'John Smith', company_name: 'Example Company Ltd.' };
    const personalized = form.body_html
      .replace(/{{\s*contact_person\s*}}/gi, sampleClient.contact_person)
      .replace(/{{\s*company_name\s*}}/gi, sampleClient.company_name);
    const formatted = formatBodyAsHtml(personalized);
    const html = form.channel === 'email' ? wrapInBrandedTemplate(formatted) : null;
    setPreviewHtml(form.channel === 'email' ? html : personalized);
  }

  async function sendNow() {
    if (!form.body_html.trim()) { alert('Write your message first.'); return; }
    if (!window.confirm('Send this email campaign right now to all matching recipients?')) return;
    setSending(true);
    const saved = await saveCampaign('draft');
    if (!saved) { setSending(false); return; }
    const { data, error } = await supabase.functions.invoke('send-campaign', { body: { campaign_id: saved.id } });
    setSending(false);
    if (error) { alert('Send failed: ' + error.message); return; }
    if (data?.error) { alert(data.error); return; }
    alert(`Sent to ${data.sentCount} of ${data.totalRecipients} recipients.${data.ccList?.length ? ` CC'd: ${data.ccList.join(', ')}` : ''}`);
    load();
  }

  async function generateWhatsAppLinks() {
    if (!form.body_html.trim()) { alert('Write your WhatsApp message first.'); return; }
    setGenerating(true);
    const recipients = await resolveRecipients(form);
    const withPhone = recipients.filter((c) => c.whatsapp);
    const withoutPhone = recipients.length - withPhone.length;
    const links = withPhone.map((c) => ({
      id: c.id,
      name: c.company_name,
      contact: c.contact_person,
      url: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(personalize(form.body_html, c))}`,
    }));
    setWaLinks({ links, skipped: withoutPhone, total: recipients.length });
    setGenerating(false);
  }

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };
  const filteredManualClients = allClients.filter((c) =>
    `${c.company_name} ${c.contact_person}`.toLowerCase().includes(manualSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#F9FAFB", marginBottom: 20 }}>
        <input style={inp} placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <select style={inp} value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Channel selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[['email', '📧 Email'], ['whatsapp', '💬 WhatsApp']].map(([val, label]) => (
            <button key={val} onClick={() => { setForm({ ...form, channel: val }); setWaLinks(null); }}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: form.channel === val ? "2px solid #6366F1" : "1px solid #E5E7EB",
                background: form.channel === val ? "#EEF2FF" : "#fff",
                color: form.channel === val ? "#4338CA" : "#6B7280",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Targeting mode */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>WHO IS THIS FOR?</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[['type', 'By Type'], ['list', 'Custom List'], ['manual', 'Pick Manually']].map(([val, label]) => (
            <button key={val} onClick={() => setForm({ ...form, target_mode: val })}
              style={{
                flex: 1, padding: "7px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: form.target_mode === val ? "1px solid #6366F1" : "1px solid #E5E7EB",
                background: form.target_mode === val ? "#EEF2FF" : "#fff",
                color: form.target_mode === val ? "#4338CA" : "#6B7280",
              }}>
              {label}
            </button>
          ))}
        </div>

        {form.target_mode === 'type' && (
          <>
            <select style={inp} value={form.target_client_type} onChange={(e) => setForm({ ...form, target_client_type: e.target.value })}>
              <option value="all">All clients</option><option value="past">Past clients</option>
              <option value="present">Present clients</option><option value="potential">Potential clients</option>
            </select>
            <input style={inp} placeholder="Sector filter (optional, e.g. construction)" value={form.target_sector} onChange={(e) => setForm({ ...form, target_sector: e.target.value })} />
          </>
        )}

        {form.target_mode === 'list' && (
          <select style={inp} value={form.target_list_id} onChange={(e) => setForm({ ...form, target_list_id: e.target.value })}>
            <option value="">— Select a custom list —</option>
            {customLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        {form.target_mode === 'manual' && (
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, marginBottom: 8, background: "#fff" }}>
            <input style={{ ...inp, marginBottom: 6 }} placeholder="Search clients to pick…" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} />
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {filteredManualClients.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 2px", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.target_client_ids.includes(c.id)} onChange={() => toggleManualClient(c.id)} />
                  <span>{c.company_name} <span style={{ color: "#9CA3AF" }}>· {c.contact_person}</span></span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 600, marginTop: 6 }}>{form.target_client_ids.length} client(s) selected</div>
          </div>
        )}

        {form.channel === 'email' ? (
          <input style={inp} placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        ) : null}

        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          <button type="button" onClick={() => applyFormat('bold')} style={{ width: 30, height: 30, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>B</button>
          <button type="button" onClick={() => applyFormat('italic')} style={{ width: 30, height: 30, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: "pointer", fontStyle: "italic", fontSize: 13 }}>I</button>
          {form.channel === 'whatsapp' ? (
            <button type="button" onClick={() => applyFormat('strike')} style={{ width: 30, height: 30, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: "pointer", textDecoration: "line-through", fontSize: 13 }}>S</button>
          ) : (
            <button type="button" onClick={() => applyFormat('link')} style={{ width: 30, height: 30, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}>🔗</button>
          )}
          <span style={{ fontSize: 10, color: "#9CA3AF", alignSelf: "center", marginLeft: 4 }}>Select text, then click a button to format it</span>
        </div>

        <textarea
          ref={bodyRef}
          style={{ ...inp, minHeight: 100, resize: "vertical" }}
          placeholder={form.channel === 'whatsapp' ? "WhatsApp message. Use {{contact_person}} and {{company_name}} for personalization." : "Email body (HTML ok). Use {{contact_person}} and {{company_name}} for personalization."}
          value={form.body_html}
          onChange={(e) => setForm({ ...form, body_html: e.target.value })}
        />

        {form.channel === 'email' && (
          <>
            <input ref={attachmentInputRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleAttachmentUpload} />
            {form.attachment_url ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: "#065F46" }}>📎 {form.attachment_name}</span>
                <button onClick={() => setForm((f) => ({ ...f, attachment_url: '', attachment_name: '' }))} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
              </div>
            ) : (
              <button onClick={() => attachmentInputRef.current.click()} disabled={uploadingAttachment} style={{ ...inp, textAlign: "left", cursor: "pointer", color: "#6B7280", background: "#fff" }}>
                {uploadingAttachment ? "Uploading…" : "📎 Attach image or PDF (optional, max 10MB)"}
              </button>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151", marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.cc_senior_management} onChange={(e) => setForm({ ...form, cc_senior_management: e.target.checked })} />
              CC senior management on this email (keeps the team in the loop)
            </label>

            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Send date/time (leave blank to send ASAP)</div>
            <input type="datetime-local" style={inp} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </>
        )}

        {form.channel === 'whatsapp' ? (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => saveCampaign('draft')} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Save draft</button>
            <button onClick={showPreview} style={{ flex: 1, background: "#fff", border: "1px solid #6366F1", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#6366F1", cursor: "pointer" }}>👁 Preview</button>
            <button onClick={generateWhatsAppLinks} disabled={generating} style={{ flex: 1, background: "#10B981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: generating ? 0.6 : 1 }}>
              {generating ? "Generating…" : "💬 Generate WhatsApp Links"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => saveCampaign('draft')} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Save draft</button>
            <button onClick={showPreview} style={{ flex: 1, background: "#fff", border: "1px solid #6366F1", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#6366F1", cursor: "pointer" }}>👁 Preview</button>
            <button onClick={sendNow} disabled={sending} style={{ flex: 1, background: "#10B981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
              {sending ? "Sending…" : "📧 Send Now"}
            </button>
          </div>
        )}

        {previewHtml !== null && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={e => e.target === e.currentTarget && setPreviewHtml(null)}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #F3F4F6", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Preview — exactly what the client will see</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Sample personalization shown: "John Smith" / "Example Company Ltd."</div>
                </div>
                <button style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13 }} onClick={() => setPreviewHtml(null)}>✕</button>
              </div>
              <div style={{ padding: "20px" }}>
                {form.channel === 'email' ? (
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                    <iframe title="Email preview" srcDoc={previewHtml} style={{ width: "100%", height: 500, border: "none" }} />
                  </div>
                ) : (
                  <div style={{ background: "#DCF8C6", borderRadius: 10, padding: 16, fontSize: 14, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{previewHtml}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {waLinks && (
          <div style={{ marginTop: 14, border: "1px solid #A7F3D0", borderRadius: 10, padding: 12, background: "#ECFDF5" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", marginBottom: 6 }}>
              {waLinks.links.length} WhatsApp link{waLinks.links.length !== 1 ? 's' : ''} ready
              {waLinks.skipped > 0 && <span style={{ fontWeight: 400, color: "#92400E" }}> · {waLinks.skipped} skipped (no WhatsApp number on file)</span>}
            </div>
            <div style={{ fontSize: 11, color: "#065F46", marginBottom: 10 }}>Click each link to open WhatsApp with the message pre-filled, then hit send. This opens one chat at a time — no bulk auto-send.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {waLinks.links.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #A7F3D0", borderRadius: 8, padding: "8px 12px", fontSize: 12, textDecoration: "none", color: "#111827" }}>
                  <span>{l.name} <span style={{ color: "#9CA3AF" }}>· {l.contact}</span></span>
                  <span style={{ color: "#10B981", fontWeight: 600 }}>Open chat →</span>
                </a>
              ))}
            </div>
            {waLinks.links.length === 0 && <div style={{ fontSize: 12, color: "#92400E" }}>No matching clients have a WhatsApp number on file.</div>}
          </div>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Recent campaigns</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campaigns.map((c) => (
          <div key={c.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, background: "#fff", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.channel === 'whatsapp' ? '💬' : '📧'} {c.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>
                {c.campaign_type} · targets: {c.target_mode === 'list' ? (c.client_lists?.name || 'custom list') : c.target_mode === 'manual' ? `${c.target_client_ids?.length || 0} hand-picked` : c.target_client_type}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#F3F4F6", color: "#374151", alignSelf: "flex-start" }}>{c.status}</span>
          </div>
        ))}
        {campaigns.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>No campaigns yet.</div>}
      </div>
    </div>
  );
}
