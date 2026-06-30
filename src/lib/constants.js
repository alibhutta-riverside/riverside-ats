// ─── PIPELINE STAGES (your specified order) ──────────────────────────────────
export const STAGES = [
  { id:"databank",  label:"CV Databank (Unassigned)",   color:"#9CA3AF" },
  { id:"shortlist", label:"Shortlisted",                 color:"#3B82F6" },
  { id:"interview", label:"Interviews",                  color:"#A855F7" },
  { id:"offer",     label:"Offer Letter",                 color:"#0EA5E9" },
  { id:"contract",  label:"Contract Signed",              color:"#14B8A6" },
  { id:"visaauth",  label:"Visa Authorisation",           color:"#6366F1" },
  { id:"evisa",     label:"Electronic No. (Muqeem/MOFA)", color:"#EC4899" },
  { id:"visano",    label:"Visa No. Issued",              color:"#8B5CF6" },
  { id:"visaissue", label:"Visa Issue Confirmed",         color:"#A855F7" },
  { id:"medical",   label:"Medical (GAMCA)",              color:"#F97316" },
  { id:"tradetest", label:"Trade Test (Takamol)",         color:"#F59E0B" },
  { id:"ppsubmit",  label:"Passport Submission",          color:"#8B5CF6" },
  { id:"ppdispatch",label:"Passport Dispatched",          color:"#7C3AED" },
  { id:"ppreceived",label:"Received by Embassy",          color:"#6D28D9" },
  { id:"stamping",  label:"Visa Stamping",                color:"#3B82F6" },
  { id:"beoe",      label:"BEOE / Protector",             color:"#0EA5E9" },
  { id:"flight",    label:"Flight Booking",                color:"#14B8A6" },
  { id:"deployed",  label:"Deployed ✓",                   color:"#10B981" },
  { id:"rejected",  label:"Rejected / Cancelled",         color:"#6B7280" },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map(s=>[s.id,s]));

export const COUNTRIES = ["Saudi Arabia","UAE","Qatar","Kuwait","Bahrain","Oman","Other"];
export const YNP = ["","Yes","No","Pending"];
export const PP_STATUSES = ["","Not Submitted","Submitted","Dispatched","Received by Embassy","Returned with Visa"];
export const TRADE_TEST_OPTS = ["","Pass","Fail","Pending","Not Required"];

export const uid = () => Math.random().toString(36).slice(2,9);
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
export const today = () => new Date().toLocaleDateString("en-GB");
export const todayISO = () => new Date().toISOString().slice(0,10);

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr) - new Date()) / 86400000);
};

// Date columns that must be null (not "") when empty, or Postgres rejects them
export const DATE_FIELDS = [
  "passport_expiry","date_of_birth","visa_auth_date","visa_issue_date",
  "medical_date","medical_expiry","trade_test_date","pp_sub_date",
  "pp_dispatch_date","pp_received_date","stamping_date","flight_date","deadline"
];

// Call this on any candidate/job object right before sending to Supabase
export const sanitizeForDb = (obj) => {
  const clean = { ...obj };
  DATE_FIELDS.forEach(f => {
    if (f in clean && clean[f] === "") clean[f] = null;
  });
  return clean;
};

export const EMPTY_CAND = {
  name:"",father_name:"",cnic:"",phone:"",email:"",trade:"",experience:"",education:"",
  nationality:"Pakistani",passport:"",passport_expiry:"",photo_url:"",cv_url:"",
  date_of_birth:"",source:"",databank_notes:"",
  job_id:null,stage:"databank",
  offer_letter:"",contract:"",
  electronic_no:"",visa_auth_date:"",visa_no:"",visa_issue_date:"",
  medical_status:"",medical_date:"",medical_expiry:"",
  trade_test_status:"",trade_test_date:"",
  pp_sub_status:"",pp_sub_date:"",pp_dispatch_date:"",pp_received_date:"",
  stamping_date:"",
  beoe_status:"",beoe_permission_no:"",beoe_registration_no:"",beoe_fee_paid:"",
  flight_date:"",
  objection:"",remarks:""
};

export const EMPTY_JOB = {
  ref:"",client:"",country:"Saudi Arabia",city:"",
  position:"",vacancies:1,salary:"",deadline:"",
  status:"Open",contact:"",notes:""
};
