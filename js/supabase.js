
const SUPABASE_URL = "https://mfojaoazhtoizjbcjbqu.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mb2phb2F6aHRvaXpqYmNqYnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDQ1NjIsImV4cCI6MjA3OTUyMDU2Mn0.ccHGMJlCgSHqgaz9Vd2cEvxUmjol9QgxnbbmzNbF6aw";

console.log("Initializing Supabase client…");

window.supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("Supabase client initialized.");
