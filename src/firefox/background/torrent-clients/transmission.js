import {
  detectClientFromBody,
  detectClientFromHtml,
  detectClientFromJson,
  extractInfohash,
  looksLikeHtml,
  probeAlternateClients,
  wrongClientResult,
} from "./detect.js";

export async function probeTransmissionRpc(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/transmission/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "session-get", arguments: {} }),
      credentials: "include",
    });
    if (resp.headers.get("X-Transmission-Session-Id")) return "transmission";
    const body = await resp.text();
    if (/x-transmission-session-id/i.test(body)) return "transmission";
    try {
      if (typeof JSON.parse(body).result === "string") return "transmission";
    } catch {
      /* ignore */
    }
    return detectClientFromHtml(body) === "transmission"
      ? "transmission"
      : null;
  } catch {
    return null;
  }
}

function transmissionAuthHeader(username, password) {
  return username && password
    ? "Basic " + btoa(`${username}:${password}`)
    : null;
}

async function transmissionGetSessionId(baseUrl, authHeader) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;

  const resp = await fetch(`${baseUrl}/transmission/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method: "session-get", arguments: {} }),
    credentials: "include",
  });

  // Session ID comes in the response header (409) or can be parsed from body
  let sessionId = resp.headers.get("X-Transmission-Session-Id");
  const body = await resp.text();
  if (!sessionId) {
    const m = body.match(/X-Transmission-Session-Id:\s*(\S+)/);
    sessionId = m ? m[1] : null;
  }
  const detectedClient =
    !sessionId && looksLikeHtml(body) ? detectClientFromHtml(body) : null;
  return { status: resp.status, sessionId, detectedClient };
}

async function transmissionRequest(baseUrl, sessionId, authHeader, body) {
  const headers = {
    "Content-Type": "application/json",
    "X-Transmission-Session-Id": sessionId,
  };
  if (authHeader) headers["Authorization"] = authHeader;
  return fetch(`${baseUrl}/transmission/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function testTransmission(baseUrl, username, password) {
  const auth = transmissionAuthHeader(username, password);
  const { status, sessionId, detectedClient } = await transmissionGetSessionId(
    baseUrl,
    auth,
  );
  if (status === 401) return { ok: false, error: "auth_failed" };
  if (detectedClient) return wrongClientResult(detectedClient);
  if (!sessionId) {
    const probed = await probeAlternateClients(baseUrl, "transmission");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }

  const resp = await transmissionRequest(baseUrl, sessionId, auth, {
    method: "session-get",
    arguments: {},
  });
  if (resp.status === 401) return { ok: false, error: "auth_failed" };
  if (!resp.ok) return { ok: false, error: "connection_failed" };
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const detected = detectClientFromBody(
      text,
      resp.headers.get("content-type"),
    );
    if (detected) return wrongClientResult(detected);
    return { ok: false, error: "connection_failed" };
  }
  if (data.result === "success") {
    return { ok: true, version: data.arguments?.version };
  }
  const detected = detectClientFromJson(data);
  if (detected) return wrongClientResult(detected);
  return { ok: false, error: "connection_failed" };
}

export async function sendTransmission(baseUrl, username, password, magnetUrl) {
  const check = await testTransmission(baseUrl, username, password);
  if (!check.ok) return check;
  const auth = transmissionAuthHeader(username, password);
  const { status, sessionId } = await transmissionGetSessionId(baseUrl, auth);
  if (status === 401) return { ok: false, error: "auth_failed" };
  if (!sessionId) return { ok: false, error: "connection_failed" };

  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await transmissionRequest(baseUrl, sessionId, auth, {
      method: "torrent-get",
      arguments: { fields: ["hashString"], ids: [infohash] },
    });
    if (chk.ok) {
      const data = await chk.json();
      if (data.arguments?.torrents?.length > 0)
        return { ok: false, error: "already_exists" };
    }
  }

  const resp = await transmissionRequest(baseUrl, sessionId, auth, {
    method: "torrent-add",
    arguments: { filename: magnetUrl },
  });
  if (resp.status === 401) return { ok: false, error: "auth_failed" };
  if (!resp.ok) return { ok: false, error: "request_failed" };
  const data = await resp.json();
  if (data.result === "success") return { ok: true };
  return { ok: false, error: "request_failed" };
}
