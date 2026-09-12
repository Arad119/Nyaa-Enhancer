import {
  detectClientFromBody,
  detectClientFromJson,
  extractInfohash,
  isDelugeRpcResponse,
  probeAlternateClients,
  wrongClientResult,
} from "./detect.js";

export async function delugePost(baseUrl, body) {
  return fetch(`${baseUrl}/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function probeDelugeRpc(baseUrl) {
  try {
    const resp = await delugePost(baseUrl, {
      method: "auth.login",
      params: [""],
      id: 0,
    });
    if (!resp.ok) return null;
    const data = JSON.parse(await resp.text());
    return isDelugeRpcResponse(data) ? "deluge" : null;
  } catch {
    return null;
  }
}

export async function testDeluge(baseUrl, password) {
  const resp = await delugePost(baseUrl, {
    method: "auth.login",
    params: [password || ""],
    id: 1,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const detected = detectClientFromBody(
      text,
      resp.headers.get("content-type"),
    );
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "deluge");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const detected = detectClientFromBody(
      text,
      resp.headers.get("content-type"),
    );
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "deluge");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  if (isDelugeRpcResponse(data)) {
    if (data.result === true) return { ok: true };
    if (data.error) return { ok: false, error: "connection_failed" };
    return { ok: false, error: "auth_failed" };
  }
  const detected = detectClientFromJson(data);
  if (detected) return wrongClientResult(detected);
  const probed = await probeAlternateClients(baseUrl, "deluge");
  if (probed) return wrongClientResult(probed);
  return { ok: false, error: "connection_failed" };
}

export async function sendDeluge(baseUrl, password, magnetUrl) {
  const check = await testDeluge(baseUrl, password);
  if (!check.ok) return check;
  const loginResp = await delugePost(baseUrl, {
    method: "auth.login",
    params: [password || ""],
    id: 1,
  });
  if (!loginResp.ok) return { ok: false, error: "connection_failed" };
  const loginData = await loginResp.json();
  if (!loginData.result) return { ok: false, error: "auth_failed" };

  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await delugePost(baseUrl, {
      method: "core.get_torrent_status",
      params: [infohash, ["name"]],
      id: 2,
    });
    if (chk.ok) {
      const data = await chk.json();
      if (data.result && Object.keys(data.result).length > 0)
        return { ok: false, error: "already_exists" };
    }
  }

  const resp = await delugePost(baseUrl, {
    method: "core.add_torrent_magnet",
    params: [magnetUrl, {}],
    id: 3,
  });
  if (!resp.ok) return { ok: false, error: "request_failed" };
  const data = await resp.json();
  if (data.error) return { ok: false, error: "request_failed" };
  return { ok: true };
}
