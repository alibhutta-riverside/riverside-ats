import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const TYPES = [
  { value: 'past_client_revival', label: "We're in the market (past clients)" },
  { value: 'potential_outreach', label: 'Prospect outreach' },
  { value: 'informational', label: 'Informational / newsletter' },
  { value: 'opportunity_alert', label: 'New opportunity alert' },
];

export default function CampaignManager({ currentUser }) {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({
    name: '', campaign_type: 'informational', subject: '', body_html: '',
    target_client_type: 'all', target_sector: '', scheduled_at: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data ?? []);
  }

  async function saveCampaign(status) {
    await supabase.from('campaigns').insert({
      ...form, status, created_by: currentUser.id,
      scheduled_at: form.scheduled_at || new Date().toISOString(),
    });
    setForm({ name: '', campaign_type: 'informational', subject: '', body_html: '', target_client_type: 'all', target_sector: '', scheduled_at: '' });
    load();
  }

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#F9FAFB", marginBottom: 20 }}>
        <input style={inp} placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <select style={inp} value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select style={inp} value={form.target_client_type} onChange={(e) => setForm({ ...form, target_client_type: e.target.value })}>
          <option value="all">All clients</option><option value="past">Past clients</option>
          <option value="present">Present clients</option><option value="potential">Potential clients</option>
        </select>

        <input style={inp} placeholder="Sector filter (optional, e.g. construction)" value={form.target_sector} onChange={(e) => setForm({ ...form, target_sector: e.target.value })} />
        <input style={inp} placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <textarea style={{ ...inp, minHeight: 100, resize: "vertical" }} placeholder="Email body (HTML ok). Use {{contact_person}} and {{company_name}} for personalization." value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} />

        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Send date/time (leave blank to send ASAP)</div>
        <input type="datetime-local" style={inp} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={() => saveCampaign('draft')} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Save draft</button>
          <button onClick={() => saveCampaign('scheduled')} style={{ flex: 1, background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Schedule send</button>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Recent campaigns</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campaigns.map((c) => (
          <div key={c.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, background: "#fff", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{c.campaign_type} · targets: {c.target_client_type}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#F3F4F6", color: "#374151", alignSelf: "flex-start" }}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
