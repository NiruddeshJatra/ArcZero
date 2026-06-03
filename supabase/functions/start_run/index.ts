const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function strToBase64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return base64url(sig);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const secret = Deno.env.get('RUN_TOKEN_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'server_error' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { player_id, seed, device } = await req.json();

    const payloadObj = {
      player_id: String(player_id ?? ''),
      seed: String(seed ?? '0'),
      device: String(device ?? 'desktop'),
      issued_at: Date.now(),
      nonce: crypto.randomUUID(),
    };

    const payloadB64 = strToBase64url(JSON.stringify(payloadObj));
    const sig = await hmacSign(payloadB64, secret);
    const token = `${payloadB64}.${sig}`;

    return new Response(JSON.stringify({ token }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', detail: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
