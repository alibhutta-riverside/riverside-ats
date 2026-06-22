import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  const inp = { padding:"11px 14px", border:"1px solid #E5E7EB", borderRadius:10, fontSize:14, width:"100%", color:"#111827", background:"#fff", outline:"none", marginBottom:12, fontFamily:"inherit" };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    if (!fullName.trim()) { setError("Please enter your full name"); setLoading(false); return; }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    if (error) { setError(error.message); }
    else { setInfo("Account created! If email confirmation is enabled, check your inbox. Otherwise you can sign in now."); setMode("signin"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#EEF2FF,#F9FAFB)", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding:16 }}>
      <div style={{ width:"100%", maxWidth:400, background:"#fff", borderRadius:18, boxShadow:"0 25px 50px rgba(0,0,0,.08)", padding:"36px 32px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"linear-gradient(135deg,#6366F1,#8B5CF6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:24, fontWeight:700, margin:"0 auto 14px" }}>R</div>
          <div style={{ fontWeight:700, fontSize:19 }}>Riverside ATS</div>
          <div style={{ fontSize:13, color:"#9CA3AF", marginTop:2 }}>Overseas Recruitment Platform</div>
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:22, background:"#F3F4F6", borderRadius:10, padding:4 }}>
          <button onClick={()=>{setMode("signin");setError("");setInfo("");}} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontSize:13, fontWeight:600, cursor:"pointer", background:mode==="signin"?"#fff":"transparent", color:mode==="signin"?"#111827":"#6B7280", boxShadow:mode==="signin"?"0 1px 3px rgba(0,0,0,.08)":"none" }}>Sign In</button>
          <button onClick={()=>{setMode("signup");setError("");setInfo("");}} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontSize:13, fontWeight:600, cursor:"pointer", background:mode==="signup"?"#fff":"transparent", color:mode==="signup"?"#111827":"#6B7280", boxShadow:mode==="signup"?"0 1px 3px rgba(0,0,0,.08)":"none" }}>New Staff Account</button>
        </div>

        <form onSubmit={mode==="signin"?handleSignIn:handleSignUp}>
          {mode==="signup" && (
            <input style={inp} placeholder="Full name" value={fullName} onChange={e=>setFullName(e.target.value)} required />
          )}
          <input style={inp} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />

          {error && <div style={{ background:"#FEF2F2", border:"1px solid #FEE2E2", color:"#991B1B", borderRadius:8, padding:"9px 12px", fontSize:12, marginBottom:12 }}>{error}</div>}
          {info && <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", borderRadius:8, padding:"9px 12px", fontSize:12, marginBottom:12 }}>{info}</div>}

          <button type="submit" disabled={loading} style={{ width:"100%", padding:"11px 0", borderRadius:10, border:"none", background:"#6366F1", color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer", opacity:loading?.6:1 }}>
            {loading?"Please wait…":mode==="signin"?"Sign In":"Create Account"}
          </button>
        </form>

        <div style={{ textAlign:"center", fontSize:11, color:"#9CA3AF", marginTop:20 }}>
          New accounts are created as "Staff" by default.<br/>Ask your Admin to upgrade your access level.
        </div>
      </div>
    </div>
  );
}
