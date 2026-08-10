import { createClient } from 'npm:@supabase/supabase-js@2';
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error: authError } = await admin.auth.getUser(token);
    if (authError || !data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const channel = String(body.channel ?? '').trim();
    const roleParam = String(body.role ?? '').toLowerCase();
    const uid = Number.isFinite(Number(body.uid)) ? Number(body.uid) : 0;

    if (!channel) {
      return new Response(JSON.stringify({ error: 'Missing channel' }), { status: 400, headers: corsHeaders });
    }

    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: 'Agora credentials not configured' }), { status: 500, headers: corsHeaders });
    }

    const role = roleParam === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const tokenExpiration = 3600;
    const privilegeExpiration = 3600;

    const agoraToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid,
      role,
      tokenExpiration,
      privilegeExpiration,
    );

    const expiresAt = Math.floor(Date.now() / 1000) + tokenExpiration;

    return new Response(JSON.stringify({ token: agoraToken, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message ?? 'Token generation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
