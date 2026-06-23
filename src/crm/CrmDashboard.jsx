import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CrmDashboard({ currentUser }) {
  const [alerts, setAlerts] = useState([]);
  const [dueFollowups, setDueFollowups] = useState([]);
  const [stats, setStats] = useState({ past: 0, present: 0, potential: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: alertData }, { data: followupData }, { data: clientCounts }] = await Promise.all([
      supabase.from('alerts').select('*, clients(company_name)').eq('team_member_id', currentUser.id).eq('is_read', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('interactions').select('*, clients(company_name, contact_person, phone, whatsapp)').eq('team_member_id', currentUser.id).lte('next_followup_date', today).not('next_followup_date', 'is', null).order('next_followup_date', { ascending: true }),
      supabase.from('clients').select('client_type'),
    ]);

    setAlerts(alertData ?? []);
    setDueFollowups(followupData ?? []);

    const counts = { past: 0, present: 0, potential: 0 };
    (clientCounts ?? []).forEach((c) => { counts[c.client_type] = (counts[c.client_type] ?? 0) + 1; });
    const overdue = (followupData ?? []).filter((f) => f.next_followup_date < today).length;
    setStats({ ...counts, overdue });
    setLoading(false);
  }

  async function markAlertRead(id) {
    await supabase.from('alerts').update({ is_read: true }).eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const card = { background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" };
  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <div style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>Loading dashboard…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Present" value={stats.present} accent="#10B981" />
        <StatCard label="Potential" value={stats.potential} accent="#3B82F6" />
        <StatCard label="Past" value={stats.past} accent="#9CA3AF" />
        <StatCard label="Overdue" value={stats.overdue} accent="#EF4444" />
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, fontSize: 14 }}>Your follow-ups due</div>
        <div style={{ padding: dueFollowups.length ? 0 : 18 }}>
          {dueFollowups.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Nothing due. You're clear.</div>}
          {dueFollowups.map((f) => {
            const overdue = f.next_followup_date < today;
            return (
              <div key={f.id} style={{ padding: "12px 18px", borderBottom: "1px solid #F9FAFB", background: overdue ? "#FEF2F2" : "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.clients?.company_name}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{f.clients?.contact_person}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: overdue ? "#FEE2E2" : "#FEF3C7", color: overdue ? "#991B1B" : "#92400E" }}>
                    {overdue ? "Overdue" : "Due today"}
                  </span>
                </div>
                {f.next_followup_notes && <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>{f.next_followup_notes}</div>}
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  {f.clients?.whatsapp && <a href={`https://wa.me/${f.clients.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#10B981", textDecoration: "none" }}>WhatsApp</a>}
                  {f.clients?.phone && <a href={`tel:${f.clients.phone}`} style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", textDecoration: "none" }}>Call</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={card}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, fontSize: 14 }}>Alerts</div>
          {alerts.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 18px", borderBottom: "1px solid #F9FAFB", background: "#FFFBEB", fontSize: 12 }}>
              <span style={{ flex: 1 }}>{a.message}</span>
              <button onClick={() => markAlertRead(a.id)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 11, cursor: "pointer", marginLeft: 10 }}>Dismiss</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E5E7EB", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: accent }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}
