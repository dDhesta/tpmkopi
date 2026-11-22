const SUPABASE_URL = "https://pxtuvkpyyzujzeiywour.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_47_TljLIRHGE4jgMfdObVg_l47vt2wH";

window.tpmSupabase = window.tpmSupabase || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.formatRp = (angka) => 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
window.formatTgl = (tgl) => tgl ? new Date(tgl).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric'
}) : '-';