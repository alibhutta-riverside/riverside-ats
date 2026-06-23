import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

function exportClientsExcel(clients, filterType) {
  const wb = XLSX.utils.book_new();
  const title = filterType === 'all' ? 'ALL CLIENTS' : filterType.toUpperCase() + ' CLIENTS';
  const headers = ["S.No", "Company", "Contact Person", "Designation", "Phone", "WhatsApp", "Email", "Country", "Sector", "Type", "Owner", "Last Contact", "Next Follow-up"];
  const rows = clients.map((c, i) => [
    i + 1, c.company_name, c.contact_person, c.designation, c.phone, c.whatsapp, c.email, c.country, c.sector, c.client_type,
    c.team_members?.full_name || "—", c.last_interaction || "—", c.next_followup || "—",
  ]);
  const today = new Date().toLocaleDateString("en-GB");
  const ws = XLSX.utils.aoa_to_sheet([
    [`RIVERSIDE ENTERPRISES — ${title} REPORT`],
    [`Generated: ${today} | Total: ${clients.length}`],
    [],
    headers,
    ...rows,
  ]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }];
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, `Riverside_${title.replace(/\s+/g, "_")}_${today.replace(/\//g, "-")}.xlsx`);
}

function buildClientsWA(clients, filterType) {
  const today = new Date().toLocaleDateString("en-GB");
  const label = filterType === 'all' ? 'All Clients' : filterType.charAt(0).toUpperCase() + filterType.slice(1) + ' Clients';
  const lines = clients.slice(0, 25).map((c, i) => `${i + 1}. *${c.company_name}* — ${c.contact_person || '—'} (${c.sector || '—'})`).join('\n');
  const more = clients.length > 25 ? `\n…and ${clients.length - 25} more` : '';
  return `🏢 *RIVERSIDE ENTERPRISES*\n_Overseas Recruitment Consultants_\n\n📋 *${label} Report*\n━━━━━━━━━━━━━━━━━━━\n*Total:* ${clients.length}\n*Date:* ${today}\n\n${lines}${more}\n━━━━━━━━━━━━━━━━━━━\n_Riverside Enterprises Recruitment Consultants_`;
}

export default function CrmReports() {
  const [filterType, setFilterType] = useState('all');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waText, setWaText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, [filterType]);

  async function load() {
    setLoading(true);
    let query = supabase.from('clients').select('*, team_members(full_name)').order('company_name', { ascending: true });
    if (filterType !== 'all') query = query.eq('client_type', filterType);
    const { data } = await query;
    setClients(data ?? []);
    setLoading(false);
    setWaText('');
  }

  const btn = (extra = {}) => ({ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", ...extra });
  const inp = { padding: "8px 11px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 18, background: "#F9FAFB", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Generate Client Report</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>Export your client list as Excel, or generate a WhatsApp summary.</div>

        <select style={{ ...inp, width: "100%", marginBottom: 12 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All clients</option>
          <option value="present">Present clients</option>
          <option value="potential">Potential clients</option>
          <option value="past">Past clients</option>
        </select>

        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>{loading ? "Loading…" : `${clients.length} client(s) match this filter`}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...btn({ background: "#6366F1", color: "#fff", border: "none" }), opacity: clients.length ? 1 : 0.5 }} disabled={!clients.length} onClick={() => exportClientsExcel(clients, filterType)}>📊 Export to Excel</button>
          <button style={{ ...btn({ background: "#25D366", color: "#fff", border: "none" }), opacity: clients.length ? 1 : 0.5 }} disabled={!clients.length} onClick={() => setWaText(buildClientsWA(clients, filterType))}>📱 WhatsApp Summary</button>
        </div>
      </div>

      {waText && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>WhatsApp Message</div>
            <button style={btn({ background: copied ? "#10B981" : "#fff", color: copied ? "#fff" : "#374151", fontSize: 12, padding: "5px 12px" })}
              onClick={() => { navigator.clipboard.writeText(waText); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <pre style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "14px 16px", fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "monospace", color: "#166534", lineHeight: 1.7, margin: 0 }}>{waText}</pre>
        </div>
      )}
    </div>
  );
}
