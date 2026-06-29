import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_CLIENT = {
  company_name: '', contact_person: '', designation: '', email: '', phone: '', whatsapp: '',
  country: '', sector: '', client_type: 'potential', source: '', notes: '',
};

export default function ClientList({ onSelectClient, currentUser }) {
  const [clients, setClients] = useState([]);
  const [contactedIds, setContactedIds] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [engagementFilter, setEngagementFilter] = useState('all'); // 'all' | 'engaged' | 'uncontacted'
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [saving, setSaving] = useState(false);
  const [customLists, setCustomLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [clientToLists, setClientToLists] = useState({}); // client_id -> [{id,name}]
  const [listToClients, setListToClients] = useState({}); // list_id -> Set(client_id)

  useEffect(() => { loadClients(); loadLists(); }, [filter]);

  async function loadLists() {
    const { data: lists } = await supabase.from('client_lists').select('id, name').order('name');
    setCustomLists(lists ?? []);

    const { data: members } = await supabase.from('client_list_members').select('list_id, client_id');
    const c2l = {};
    const l2c = {};
    (members ?? []).forEach((m) => {
      if (!c2l[m.client_id]) c2l[m.client_id] = [];
      const listInfo = (lists ?? []).find((l) => l.id === m.list_id);
      if (listInfo) c2l[m.client_id].push(listInfo);
      if (!l2c[m.list_id]) l2c[m.list_id] = new Set();
      l2c[m.list_id].add(m.client_id);
    });
    setClientToLists(c2l);
    setListToClients(l2c);
  }

  async function createList() {
    const name = window.prompt('Name this list (e.g. "Construction Sector", "Oil & Gas"):');
    if (!name || !name.trim()) return;
    const { error } = await supabase.from('client_lists').insert({ name: name.trim(), created_by: currentUser?.id || null });
    if (error) { alert(error.message); return; }
    loadLists();
  }

  async function addToList(clientId, listId) {
    if (!listId) return;
    const { error } = await supabase.from('client_list_members').insert({ list_id: listId, client_id: clientId });
    if (error && !error.message.includes('duplicate')) { alert(error.message); return; }
    loadLists();
  }

  async function removeFromList(clientId, listId) {
    await supabase.from('client_list_members').delete().eq('list_id', listId).eq('client_id', clientId);
    loadLists();
  }

  async function loadClients() {
    setLoading(true);
    let query = supabase.from('clients').select('id, company_name, contact_person, sector, country, client_type, team_members(full_name)').order('updated_at', { ascending: false });
    if (filter !== 'all') query = query.eq('client_type', filter);
    const { data } = await query;
    setClients(data ?? []);

    const { data: interactionRows } = await supabase.from('interactions').select('client_id');
    setContactedIds(new Set((interactionRows ?? []).map((r) => r.client_id)));

    setLoading(false);
  }

  async function addClient(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { alert('Company name is required'); return; }
    setSaving(true);
    const { error } = await supabase.from('clients').insert({ ...form, assigned_to: currentUser?.id || null });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setForm(EMPTY_CLIENT);
    setShowForm(false);
    loadClients();
  }

  const filtered = clients
    .filter((c) => `${c.company_name} ${c.contact_person} ${c.sector}`.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => {
      if (engagementFilter === 'engaged') return contactedIds.has(c.id);
      if (engagementFilter === 'uncontacted') return !contactedIds.has(c.id);
      return true;
    })
    .filter((c) => !selectedListId || (listToClients[selectedListId]?.has(c.id)));

  const uncontactedCount = clients.filter((c) => !contactedIds.has(c.id)).length;
  const engagedCount = clients.filter((c) => contactedIds.has(c.id)).length;

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 8 };
  const typeStyles = {
    present: { background: "#D1FAE5", color: "#065F46" },
    potential: { background: "#DBEAFE", color: "#1E3A8A" },
    past: { background: "#F3F4F6", color: "#4B5563" },
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <button
        onClick={() => setShowForm((s) => !s)}
        style={{ width: "100%", background: showForm ? "#fff" : "#111827", color: showForm ? "#374151" : "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}
      >
        {showForm ? 'Cancel' : '+ Add New Client'}
      </button>

      {showForm && (
        <form onSubmit={addClient} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#F9FAFB", marginBottom: 16 }}>
          <input style={inp} placeholder="Company name *" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <input style={inp} placeholder="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <input style={inp} placeholder="Designation (e.g. HR Manager)" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          <input style={inp} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input style={inp} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input style={inp} placeholder="WhatsApp (with country code, e.g. 9665xxxxxxx)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <input style={inp} placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input style={inp} placeholder="Sector (e.g. construction, hospitality)" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
          <select style={inp} value={form.client_type} onChange={(e) => setForm({ ...form, client_type: e.target.value })}>
            <option value="potential">Potential</option><option value="present">Present</option><option value="past">Past</option>
          </select>
          <input style={inp} placeholder="Source (referral, exhibition, cold outreach...)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <textarea style={{ ...inp, minHeight: 50, resize: "vertical" }} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={saving} style={{ width: "100%", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Client"}
          </button>
        </form>
      )}

      <input
        type="text"
        placeholder="Search company, contact, sector…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inp, marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {['all', 'present', 'potential', 'past'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: filter === t ? "#6366F1" : "#F3F4F6", color: filter === t ? "#fff" : "#374151",
            }}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[['all', 'All'], ['engaged', `✓ Engaged (${engagedCount})`], ['uncontacted', `○ Not Contacted (${uncontactedCount})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setEngagementFilter(key)}
            style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: engagementFilter === key ? "1px solid #6366F1" : "1px solid #E5E7EB",
              background: engagementFilter === key ? "#EEF2FF" : "#fff",
              color: engagementFilter === key ? "#4338CA" : "#6B7280",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <select
          style={{ ...inp, width: "auto", marginBottom: 0 }}
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
        >
          <option value="">All Custom Lists</option>
          {customLists.map((l) => <option key={l.id} value={l.id}>{l.name} ({listToClients[l.id]?.size || 0})</option>)}
        </select>
        <button onClick={createList} style={{ ...inp, width: "auto", marginBottom: 0, cursor: "pointer", background: "#F9FAFB", fontWeight: 600, color: "#374151" }}>
          + New List
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => {
            const contacted = contactedIds.has(c.id);
            return (
              <div
                key={c.id}
                style={{ textAlign: "left", borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff", padding: 14, fontFamily: "inherit" }}
              >
                <div onClick={() => onSelectClient(c.id)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{c.company_name}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{c.contact_person} · {c.sector ?? '—'}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, ...typeStyles[c.client_type] }}>{c.client_type}</span>
                      {!contacted && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#FEF3C7", color: "#92400E" }}>Not yet contacted</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{c.country} · Owner: {c.team_members?.full_name ?? 'Unassigned'}</div>
                </div>

                {(clientToLists[c.id]?.length > 0) && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {clientToLists[c.id].map((l) => (
                      <span key={l.id} onClick={() => { if (window.confirm(`Remove from "${l.name}"?`)) removeFromList(c.id, l.id); }}
                        style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#F3E8FF", color: "#6B21A8", cursor: "pointer" }} title="Click to remove">
                        {l.name} ✕
                      </span>
                    ))}
                  </div>
                )}
                {customLists.length > 0 && (
                  <select
                    onChange={(e) => { addToList(c.id, e.target.value); e.target.value = ''; }}
                    defaultValue=""
                    style={{ marginTop: 6, fontSize: 10, padding: "3px 6px", borderRadius: 6, border: "1px solid #E5E7EB", color: "#6B7280", background: "#fff", cursor: "pointer" }}
                  >
                    <option value="" disabled>+ Add to list…</option>
                    {customLists.filter((l) => !clientToLists[c.id]?.some((cl) => cl.id === l.id)).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "30px 0" }}>No clients match.</div>}
        </div>
      )}
    </div>
  );
}
