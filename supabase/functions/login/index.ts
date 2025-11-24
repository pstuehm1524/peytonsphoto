export default async function handler(req: Request) {
  const { password } = await req.json();

  const ADMIN_PASSWORD = "2004Jeep*"; // <-- this is it

  if (password !== ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ success: false, error: "Incorrect password" }),
      { status: 401 }
    );
  }

  return new Response(JSON.stringify({ success: true }));
}
