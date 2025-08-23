// supabase-config.js

// Replace these values with your Supabase project info
const SUPABASE_URL = "https://ekgqwgqnhpvucwnuupxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZ3F3Z3FuaHB2dWN3bnV1cHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NzI4NDgsImV4cCI6MjA3MTU0ODg0OH0.IxtcWi0xT6LD-mDeLf4QmVHSJuFKQIuvEqWkBlWRBEs";

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
