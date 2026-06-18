// Raw HTTPS client for Pesepay. Pesepay's live API returns an HTTP/1.1 status
// line without a reason phrase ("HTTP/1.1 404 \r\n"), which Deno's `fetch`
// (hyper) rejects with "invalid HTTP header parsed". We hand-roll the request
// over a TLS socket and parse the response ourselves to dodge that strictness.

export interface PesepayResponse {
  status: number;
  body: string;
}

export async function pesepayRequest(
  url: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body?: string,
): Promise<PesepayResponse> {
  const u = new URL(url);
  const host = u.hostname;
  const port = u.port ? Number(u.port) : 443;
  const path = u.pathname + (u.search || "");

  const conn = await Deno.connectTls({ hostname: host, port });

  try {
    const hdrLines = [`${method} ${path} HTTP/1.1`, `Host: ${host}`, `Connection: close`, `Accept: application/json`];
    if (body !== undefined) {
      hdrLines.push(`Content-Length: ${new TextEncoder().encode(body).length}`);
    }
    for (const [k, v] of Object.entries(headers)) hdrLines.push(`${k}: ${v}`);
    const req = hdrLines.join("\r\n") + "\r\n\r\n" + (body ?? "");
    await conn.write(new TextEncoder().encode(req));

    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(8192);
    while (true) {
      try {
        const n = await conn.read(buf);
        if (n === null) break;
        chunks.push(buf.slice(0, n));
      } catch {
        // Pesepay often closes the TLS connection without a close_notify.
        break;
      }
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    const text = new TextDecoder().decode(out);

    const headerEnd = text.indexOf("\r\n\r\n");
    if (headerEnd === -1) return { status: 0, body: text };

    const head = text.slice(0, headerEnd);
    let bodyText = text.slice(headerEnd + 4);
    const statusLine = head.split("\r\n")[0] || "";
    const status = parseInt(statusLine.split(" ")[1] || "0", 10);

    if (/transfer-encoding:\s*chunked/i.test(head)) {
      let decoded = "";
      let i = 0;
      while (i < bodyText.length) {
        const lineEnd = bodyText.indexOf("\r\n", i);
        if (lineEnd === -1) break;
        const size = parseInt(bodyText.slice(i, lineEnd), 16);
        if (!size || Number.isNaN(size)) break;
        decoded += bodyText.slice(lineEnd + 2, lineEnd + 2 + size);
        i = lineEnd + 2 + size + 2;
      }
      bodyText = decoded;
    }

    return { status, body: bodyText };
  } finally {
    try { conn.close(); } catch { /* already closed */ }
  }
}
