import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  try {
    // Check Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      return new Response(JSON.stringify({ success: false, error: "Missing or invalid authorization header" }), { status: 401 });
    }

    const { id, storagePath, admin_password } = await req.json();

    if (admin_password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: false, error: "Incorrect admin password" }), { status: 401 });
    }

    if (!id || !storagePath) {
      return new Response(JSON.stringify({ success: false, error: "Missing id or storagePath" }), { status: 400 });
    }

    // Delete file from Storage
    const { error: storageError } = await supabase.storage.from("images").remove([storagePath]);
    if (storageError) throw storageError;

    // Delete record from 'images' table
    const { error: dbError } = await supabase.from("images").delete().eq("id", id);
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("Delete function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
});
