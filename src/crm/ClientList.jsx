import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ClientList({ onSelectClient }) {
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadClients(); }, [filter]);

  async function loadClients() {
    setLoading(true);
    let query = supabase.from('clients').select('id, company_name, contact_person, sector, country, client_type, team_members(full_name)').order('updated_at', { ascending: false });
    if (filter !== 'all') query = query.eq('client_type', filter);
    const { data } = await query;
    setClients(data ?? []);
    setLoading(false);
  }

  const filtered = clients.filter((c) =>
    `${c.company_name} ${c.contact_person} ${c.sector}`.toLowerCase().includes(search.toLowerCase())
  );

  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none" };
  const typeStyles = {
    present: { background: "#D1FAE5", color: "#065F46" },
    potential: { background: "#DBEAFE", color: "#1E3A8A" },
    past: { background: "#F3F4F6", color: "#4B5563" },
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <input
        type="text"
        placeholder="Search company, contact, sector…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inp, marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
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

      {loading ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectClient(c.id)}
              style={{ textAlign: "left", borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff", padding: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{c.company_name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{c.contact_person} · {c.sector ?? '—'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, flexShrink: 0, ...typeStyles[c.client_type] }}>{c.client_type}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{c.country} · Owner: {c.team_members?.full_name ?? 'Unassigned'}</div>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "30px 0" }}>No clients match.</div>}
        </div>
      )}
    </div>
  );
}
