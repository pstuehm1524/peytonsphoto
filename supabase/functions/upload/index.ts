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

    const formData = await req.formData();
    const adminPassword = formData.get("admin_password")?.toString() || "";
    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: false, error: "Incorrect admin password" }), { status: 401 });
    }

    const gallery = formData.get("gallery")?.toString();
    const title = formData.get("title")?.toString() || "";
    const file = formData.get("image") as File;

    if (!gallery || !file) {
      return new Response(JSON.stringify({ success: false, error: "Missing gallery or file" }), { status: 400 });
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${file.name}`;
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from("images")
      .upload(`${gallery}/${fileName}`, file.stream(), { contentType: file.type });

    if (storageError) throw storageError;

    // Get public URL
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(`${gallery}/${fileName}`);
    const imageUrl = urlData.publicUrl;

    // Insert record into 'images' table
    const { error: dbError } = await supabase.from("images").insert([
      { gallery, title, image_url: imageUrl }
    ]);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, url: imageUrl }));
  } catch (err) {
    console.error("Upload function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
});
