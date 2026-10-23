// Frontend configuration. Supabase publishable/anon key is safe to use in browser when RLS is enabled. NEVER use service_role key here.
window.CLE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
};
// Shared entry code requested for songbook visitors. This is a convenience gate, NOT a security boundary for private data.
window.CLE_ACCESS_CODE = "BUHAY NA WALANG HANGGAN";
