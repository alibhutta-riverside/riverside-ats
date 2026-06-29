import { useEffect, useState } from 'react';
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
};

export default function CampaignManager({ currentUser }) {
  const [campaigns, setCampaigns] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [manualSearch, setManualSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [waLinks, setWaLinks] = useState(null); // generated whatsapp links for the active campaign
  const [generating, setGenerating] = useState(false);

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
    const { error } = await supabase.from('campaigns').insert({
      ...form, status, created_by: currentUser.id,
      scheduled_at: form.scheduled_at || new Date().toISOString(),
    });
    if (error) { alert(error.message); return; }
    setForm(EMPTY_FORM);
    setWaLinks(null);
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

        <textarea
          style={{ ...inp, minHeight: 100, resize: "vertical" }}
          placeholder={form.channel === 'whatsapp' ? "WhatsApp message. Use {{contact_person}} and {{company_name}} for personalization." : "Email body (HTML ok). Use {{contact_person}} and {{company_name}} for personalization."}
          value={form.body_html}
          onChange={(e) => setForm({ ...form, body_html: e.target.value })}
        />

        {form.channel === 'email' && (
          <>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Send date/time (leave blank to send ASAP)</div>
            <input type="datetime-local" style={inp} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </>
        )}

        {form.channel === 'whatsapp' ? (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => saveCampaign('draft')} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Save draft</button>
            <button onClick={generateWhatsAppLinks} disabled={generating} style={{ flex: 1, background: "#10B981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: generating ? 0.6 : 1 }}>
              {generating ? "Generating…" : "💬 Generate WhatsApp Links"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => saveCampaign('draft')} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Save draft</button>
            <button onClick={() => saveCampaign('scheduled')} style={{ flex: 1, background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Schedule send</button>
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
