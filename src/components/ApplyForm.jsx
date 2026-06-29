import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const EMPTY_APP = {
  name: "", father_name: "", phone: "", email: "", cnic: "",
  trade: "", experience: "", nationality: "", source: "Public Application",
  has_gcc_experience: false, gcc_countries: "", gcc_experience_years: "",
  driving_license_type: "", driving_license_country: "", driving_license_status: "",
};

export default function ApplyForm() {
  const [form, setForm] = useState(EMPTY_APP);
  const [cvFile, setCvFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bots tend to fill every field; humans never see this one
  const cvInputRef = useRef(null);

  const inp = { padding: "11px 13px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 12 };
  const label = { fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 5, display: "block" };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (honeypot) return; // silently drop bot submissions
    if (!form.name.trim()) { setError("Please enter your full name."); return; }
    if (!form.trade.trim()) { setError("Please enter your trade / desired position."); return; }
    if (!form.phone.trim()) { setError("Please enter a phone number we can reach you on."); return; }
    if (!cvFile) { setError("Please attach your CV (PDF or Word file)."); return; }

    setSubmitting(true);

    const ext = cvFile.name.split(".").pop();
    const path = `public_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("cvs").upload(path, cvFile);

    if (uploadError) {
      setSubmitting(false);
      setError("Could not upload your CV. Please make sure it's a PDF or Word file under 10MB, and try again.");
      return;
    }

    const { data: urlData } = supabase.storage.from("cvs").getPublicUrl(path);

    const { error: insertError } = await supabase.from("candidates").insert([{
      ...form,
      cv_url: urlData.publicUrl,
      stage: "databank",
      job_id: null,
      source: "Public Application",
    }]);

    setSubmitting(false);

    if (insertError) {
      setError("Something went wrong submitting your application. Please try again or email your CV to jobs@riverside.com.pk.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 440, textAlign: "center", background: "#fff", borderRadius: 16, padding: "40px 30px", border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Application Received</div>
          <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
            Thank you for applying to Riverside Enterprises Recruitment Consultants. Your details and CV have been added to our database. Our team will contact you if a suitable position becomes available.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: "30px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 auto 12px" }}>R</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Riverside Enterprises</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Overseas Recruitment Consultants, Lahore</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", border: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Submit Your Application</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Fill in your details and attach your CV. We'll keep it on file and contact you when a matching position opens.</div>

          <form onSubmit={handleSubmit}>
            {/* Honeypot - hidden from real users, bots often fill it anyway */}
            <input type="text" value={honeypot} onChange={e=>setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"
              style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }} />

            <label style={label}>Full Name *</label>
            <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f, name: e.target.value}))} placeholder="Muhammad Usman" />

            <label style={label}>Father's Name</label>
            <input style={inp} value={form.father_name} onChange={e=>setForm(f=>({...f, father_name: e.target.value}))} />

            <label style={label}>Trade / Desired Position *</label>
            <input style={inp} value={form.trade} onChange={e=>setForm(f=>({...f, trade: e.target.value}))} placeholder="Electrician, Driver, Welder…" />

            <label style={label}>Years of Experience</label>
            <input style={inp} type="number" min="0" value={form.experience} onChange={e=>setForm(f=>({...f, experience: e.target.value}))} />

            <label style={label}>Phone Number (WhatsApp preferred) *</label>
            <input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f, phone: e.target.value}))} placeholder="+92 3XX XXXXXXX" />

            <label style={label}>Email</label>
            <input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f, email: e.target.value}))} />

            <label style={label}>CNIC</label>
            <input style={inp} value={form.cnic} onChange={e=>setForm(f=>({...f, cnic: e.target.value}))} placeholder="XXXXX-XXXXXXX-X" />

            <label style={label}>Nationality</label>
            <input style={inp} value={form.nationality} onChange={e=>setForm(f=>({...f, nationality: e.target.value}))} placeholder="Pakistani" />

            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "14px 14px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", marginBottom: 10 }}>🌍 GCC / Foreign Work Experience</div>
              <label style={label}>Have you worked in Saudi Arabia or another Gulf country before?</label>
              <select style={inp} value={form.has_gcc_experience ? "yes" : "no"} onChange={e=>setForm(f=>({...f, has_gcc_experience: e.target.value==="yes"}))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {form.has_gcc_experience && (
                <>
                  <label style={label}>Which country/countries?</label>
                  <input style={inp} value={form.gcc_countries} onChange={e=>setForm(f=>({...f, gcc_countries: e.target.value}))} placeholder="Saudi Arabia, UAE, Qatar…" />
                  <label style={label}>How many years of experience there?</label>
                  <input style={inp} value={form.gcc_experience_years} onChange={e=>setForm(f=>({...f, gcc_experience_years: e.target.value}))} placeholder="e.g. 3" />
                </>
              )}
            </div>

            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "14px 14px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1E3A8A", marginBottom: 10 }}>🚛 Driving License (if applicable)</div>
              <label style={label}>Do you hold a driving license?</label>
              <select style={inp} value={form.driving_license_type} onChange={e=>setForm(f=>({...f, driving_license_type: e.target.value}))}>
                <option value="">No / Not applicable</option>
                <option value="Light Vehicle">Light Vehicle</option>
                <option value="Heavy Truck">Heavy Truck</option>
                <option value="Trailer">Trailer</option>
                <option value="Dyna">Dyna</option>
                <option value="Heavy Equipment">Heavy Equipment</option>
              </select>
              {form.driving_license_type && (
                <>
                  <label style={label}>Which country issued this license?</label>
                  <input style={inp} value={form.driving_license_country} onChange={e=>setForm(f=>({...f, driving_license_country: e.target.value}))} placeholder="Saudi Arabia, Pakistan…" />
                  <label style={label}>Is it currently valid or expired?</label>
                  <select style={inp} value={form.driving_license_status} onChange={e=>setForm(f=>({...f, driving_license_status: e.target.value}))}>
                    <option value="">—</option>
                    <option value="Valid">Valid</option>
                    <option value="Expired">Expired</option>
                  </select>
                </>
              )}
            </div>

            <label style={label}>CV File (PDF or Word, max 10MB) *</label>
            <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
              onChange={e => setCvFile(e.target.files[0] || null)} />
            <button type="button" onClick={()=>cvInputRef.current.click()}
              style={{ ...inp, textAlign: "left", cursor: "pointer", background: cvFile ? "#ECFDF5" : "#fff", color: cvFile ? "#065F46" : "#9CA3AF", borderColor: cvFile ? "#A7F3D0" : "#E5E7EB" }}>
              {cvFile ? `✓ ${cvFile.name}` : "Tap to attach your CV"}
            </button>

            {error && <div style={{ background: "#FEF2F2", color: "#991B1B", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button type="submit" disabled={submitting}
              style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "13px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.6 : 1, marginTop: 6 }}>
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 16 }}>
          By submitting, you agree to be contacted by Riverside Enterprises regarding job opportunities.
        </div>
      </div>
    </div>
  );
}
