// Returns the public PayPal client id so the browser SDK can render buttons.
// Client ID is a public value (PayPal embeds it in the SDK URL anyway).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") || "";
  return new Response(JSON.stringify({ clientId, mode: "live" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
