import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inp = { padding:"11px 14px", border:"1px solid #E5E7EB", borderRadius:10, fontSize:14, width:"100%", color:"#111827", background:"#fff", outline:"none", marginBottom:12, fontFamily:"inherit" };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
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

        <form onSubmit={handleSignIn}>
          <input style={inp} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />

          {error && <div style={{ background:"#FEF2F2", border:"1px solid #FEE2E2", color:"#991B1B", borderRadius:8, padding:"9px 12px", fontSize:12, marginBottom:12 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ width:"100%", padding:"11px 0", borderRadius:10, border:"none", background:"#6366F1", color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer", opacity:loading?.6:1 }}>
            {loading?"Please wait…":"Sign In"}
          </button>
        </form>

        <div style={{ textAlign:"center", fontSize:11, color:"#9CA3AF", marginTop:20 }}>
          New staff accounts are created by your Admin only.<br/>Contact your Admin for access.
        </div>
      </div>
    </div>
  );
}
