import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ClientDetail({ clientId, currentUser, onBack }) {
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    interaction_type: 'call', summary: '', feedback: '', outcome: 'neutral',
    next_followup_date: '', next_followup_notes: '',
  });

  useEffect(() => { load(); }, [clientId]);

  async function load() {
    const { data: c } = await supabase.from('clients').select('*, team_members(full_name)').eq('id', clientId).single();
    const { data: h } = await supabase.from('interactions').select('*, team_members(full_name)').eq('client_id', clientId).order('interaction_date', { ascending: false });
    setClient(c);
    setHistory(h ?? []);
  }

  async function submitInteraction(e) {
    e.preventDefault();
    await supabase.from('interactions').insert({
      client_id: clientId, team_member_id: currentUser.id, ...form,
      next_followup_date: form.next_followup_date || null,
    });
    await supabase.from('clients').update({ updated_at: new Date().toISOString() }).eq('id', clientId);
    setForm({ interaction_type: 'call', summary: '', feedback: '', outcome: 'neutral', next_followup_date: '', next_followup_notes: '' });
    setShowForm(false);
    load();
  }

  async function deleteClient() {
    if (!window.confirm(`Delete ${client.company_name}? This removes all contact history too. This cannot be undone.`)) return;
    await supabase.from('clients').delete().eq('id', clientId);
    onBack();
  }

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };
  const btn = (extra = {}) => ({ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", ...extra });

  if (!client) return <div style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", padding: 0 }}>← Back</button>
        <button onClick={deleteClient} style={{ background: "none", border: "1px solid #FEE2E2", color: "#EF4444", fontSize: 12, cursor: "pointer", padding: "5px 10px", borderRadius: 6 }}>Delete Client</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{client.company_name}</div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>{client.contact_person} · {client.designation}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{client.sector} · {client.country}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Owner: {client.team_members?.full_name ?? 'Unassigned'}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          {client.whatsapp && <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} style={{ fontSize: 12, fontWeight: 600, color: "#10B981", textDecoration: "none" }}>WhatsApp</a>}
          {client.phone && <a href={`tel:${client.phone}`} style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", textDecoration: "none" }}>Call</a>}
          {client.email && <a href={`mailto:${client.email}`} style={{ fontSize: 12, fontWeight: 600, color: "#8B5CF6", textDecoration: "none" }}>Email</a>}
        </div>
      </div>

      <button onClick={() => setShowForm((s) => !s)} style={{ width: "100%", background: showForm ? "#fff" : "#111827", color: showForm ? "#374151" : "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
        {showForm ? 'Cancel' : '+ Log new contact'}
      </button>

      {showForm && (
        <form onSubmit={submitInteraction} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#F9FAFB", marginBottom: 16 }}>
          <select value={form.interaction_type} onChange={(e) => setForm({ ...form, interaction_type: e.target.value })} style={inp}>
            <option value="call">Call</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option>
            <option value="in_person_visit">In-person visit</option><option value="meeting">Meeting</option><option value="other">Other</option>
          </select>
          <textarea placeholder="What happened / what was discussed" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} style={{ ...inp, minHeight: 50, resize: "vertical" }} />
          <textarea placeholder="Client's feedback / response" value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} style={{ ...inp, minHeight: 50, resize: "vertical" }} />
          <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} style={inp}>
            <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
            <option value="no_response">No response</option><option value="closed_won">Closed - Won</option><option value="closed_lost">Closed - Lost</option>
          </select>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Next follow-up date</div>
          <input type="date" value={form.next_followup_date} onChange={(e) => setForm({ ...form, next_followup_date: e.target.value })} style={inp} />
          <input type="text" placeholder="Note for next follow-up" value={form.next_followup_notes} onChange={(e) => setForm({ ...form, next_followup_notes: e.target.value })} style={inp} />
          <button type="submit" style={{ width: "100%", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </form>
      )}

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>History</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {history.map((h) => (
          <div key={h.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, background: "#fff", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9CA3AF", marginBottom: 4 }}>
              <span>{h.interaction_type} · {h.team_members?.full_name}</span>
              <span>{new Date(h.interaction_date).toLocaleDateString()}</span>
            </div>
            {h.summary && <div style={{ color: "#374151" }}>{h.summary}</div>}
            {h.feedback && <div style={{ color: "#6B7280", marginTop: 4 }}><span style={{ fontWeight: 600 }}>Feedback:</span> {h.feedback}</div>}
            {h.next_followup_date && <div style={{ color: "#3B82F6", fontSize: 11, marginTop: 4 }}>Next: {h.next_followup_date} — {h.next_followup_notes}</div>}
          </div>
        ))}
        {history.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13 }}>No contact history yet.</div>}
      </div>
    </div>
  );
}
