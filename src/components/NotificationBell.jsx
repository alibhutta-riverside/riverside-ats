// src/components/NotificationBell.jsx
// Drop into your existing components folder. Add <NotificationBell /> to
// CrmDashboard's header. Uses inline styles to match your existing components.

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient"; // adjust path if your client lives elsewhere

export default function NotificationBell({ currentUserId }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `team_member_id=eq.${currentUserId}` },
        (payload) => setAlerts((prev) => [payload.new, ...prev])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchAlerts() {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("team_member_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(20);
    setAlerts(data ?? []);
  }

  async function markAsRead(alertId) {
    await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
  }

  async function markAllAsRead() {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;
    await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  }

  const typeColor = { followup_overdue: "#dc2626", followup_due: "#d97706", campaign_sent: "#2563eb", client_assigned: "#16a34a" };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "22px",
          padding: "6px",
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#dc2626",
              color: "white",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: "bold",
              padding: "1px 6px",
              minWidth: "18px",
              textAlign: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "36px",
            width: "340px",
            maxHeight: "420px",
            overflowY: "auto",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: "1px solid #f0f0f0",
              fontWeight: 600,
            }}
          >
            <span>Follow-up Alerts</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ fontSize: "12px", color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {alerts.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
              No alerts. You're all caught up.
            </div>
          )}

          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => markAsRead(alert.id)}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #f5f5f5",
                background: alert.is_read ? "white" : "#f8fafc",
                cursor: "pointer",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  marginTop: "5px",
                  flexShrink: 0,
                  background: typeColor[alert.alert_type] ?? "#9ca3af",
                }}
              />
              <div>
                <div style={{ fontSize: "13px", color: "#1f2937" }}>{alert.message}</div>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                  {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
