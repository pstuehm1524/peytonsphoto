import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// Load environment variables
const ADMIN_PASSWORD = "password1234";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req: Request) => {
  try {
    // Check Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${SUPABASE_ANON_KEY}`) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header" }),
        { status: 401 }
      );
    }

    // Parse JSON body
    const { password } = await req.json();
    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing password" }),
        { status: 400 }
      );
    }

    // Check password
    if (password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ success: false, error: "Incorrect password" }),
        { status: 401 }
      );
    }

    // SUCCESS
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("Login function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500 }
    );
  }
});
