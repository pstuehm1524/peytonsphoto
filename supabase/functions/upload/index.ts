// Upload Function – Secure & Fully Working
// ----------------------------------------
// • Validates admin password (server-side only)
// • Uploads image to Storage bucket "images"
// • Inserts database row
// • Returns the public image URL
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type"
};
serve(async (req)=>{
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const formData = await req.formData();
    const adminPassword = formData.get("admin_password")?.toString();
    const gallery = formData.get("gallery")?.toString();
    const title = formData.get("title")?.toString() || "";
    const image = formData.get("image");
    // Validate fields
    if (!gallery || !image) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing gallery or image file"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Supabase client
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Create unique filename
    const ext = image.name.split(".").pop();
    const uniqueName = crypto.randomUUID() + "." + ext;
    const filePath = `${gallery}/${uniqueName}`;
    // Upload to storage
    const { error: uploadError } = await supabase.storage.from("images").upload(filePath, image);
    if (uploadError) {
      return new Response(JSON.stringify({
        success: false,
        error: uploadError.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    // Get public URL
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    // Insert DB row
    const { error: dbError } = await supabase.from("images").insert({
      gallery: gallery,
      title: title,
      image_url: publicUrl
    });
    if (dbError) {
      return new Response(JSON.stringify({
        success: false,
        error: dbError.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    // SUCCESS
    return new Response(JSON.stringify({
      success: true,
      url: publicUrl
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});