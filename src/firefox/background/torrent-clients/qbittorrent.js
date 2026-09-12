import {
  detectClientFromBody,
  extractInfohash,
  isValidQbtVersion,
  probeAlternateClients,
  wrongClientResult,
} from "./detect.js";

export async function probeQbtVersion(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/api/v2/app/version`, {
      credentials: "include",
    });
    const body = (await resp.text()).trim();
    return resp.ok && isValidQbtVersion(body) ? "qbittorrent" : null;
  } catch {
    return null;
  }
}

export async function qbtLogin(baseUrl, username, password) {
  const resp = await fetch(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    credentials: "include",
  });
  return (await resp.text()).trim(); // "Ok." or "Fails."
}

export async function testQbt(baseUrl, username, password) {
  if (username && password) {
    if ((await qbtLogin(baseUrl, username, password)) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const resp = await fetch(`${baseUrl}/api/v2/app/version`, {
    credentials: "include",
  });
  const body = (await resp.text()).trim();
  if (resp.ok) {
    if (isValidQbtVersion(body)) return { ok: true, version: body };
    const detected = detectClientFromBody(
      body,
      resp.headers.get("content-type"),
    );
    if (detected) return wrongClientResult(detected);
    const probed = await probeAlternateClients(baseUrl, "qbittorrent");
    if (probed) return wrongClientResult(probed);
    return { ok: false, error: "connection_failed" };
  }
  if (resp.status === 403) return { ok: false, error: "auth_required" };
  const probed = await probeAlternateClients(baseUrl, "qbittorrent");
  if (probed) return wrongClientResult(probed);
  return { ok: false, error: "connection_failed" };
}

export async function sendQbt(
  baseUrl,
  username,
  password,
  magnetUrl,
  category,
  tags,
) {
  const check = await testQbt(baseUrl, username, password);
  if (!check.ok) return check;
  if (username && password) {
    if ((await qbtLogin(baseUrl, username, password)) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  const infohash = extractInfohash(magnetUrl);
  if (infohash) {
    const chk = await fetch(
      `${baseUrl}/api/v2/torrents/info?hashes=${infohash}`,
      { credentials: "include" },
    );
    if (chk.ok) {
      const list = await chk.json();
      if (Array.isArray(list) && list.length > 0)
        return { ok: false, error: "already_exists" };
    }
  }
  const bodyParts = [`urls=${encodeURIComponent(magnetUrl)}`];
  if (category && category.trim()) {
    bodyParts.push(`category=${encodeURIComponent(category.trim())}`);
  }
  if (tags && Array.isArray(tags) && tags.length > 0) {
    const tagStr = tags.filter((t) => t && t.trim()).join(",");
    if (tagStr) {
      bodyParts.push(`tags=${encodeURIComponent(tagStr)}`);
    }
  }
  const resp = await fetch(`${baseUrl}/api/v2/torrents/add`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParts.join("&"),
    credentials: "include",
  });
  if (resp.ok) return { ok: true };
  if (resp.status === 403) return { ok: false, error: "auth_required" };
  return { ok: false, error: "request_failed" };
}

export async function fetchQbtCategoriesAndTags(baseUrl, username, password) {
  const check = await testQbt(baseUrl, username, password);
  if (!check.ok) return check;
  if (username && password) {
    if ((await qbtLogin(baseUrl, username, password)) === "Fails.") {
      return { ok: false, error: "auth_failed" };
    }
  }
  try {
    const [catResp, tagsResp] = await Promise.all([
      fetch(`${baseUrl}/api/v2/torrents/categories`, {
        credentials: "include",
      }),
      fetch(`${baseUrl}/api/v2/torrents/tags`, { credentials: "include" }),
    ]);
    let categories = [];
    if (catResp.ok) {
      const catJson = await catResp.json();
      if (catJson && typeof catJson === "object") {
        categories = Object.keys(catJson).filter((k) => k && k.trim());
      }
    }
    let tags = [];
    if (tagsResp.ok) {
      const tagsText = await tagsResp.text();
      try {
        const parsed = JSON.parse(tagsText);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t) => typeof t === "string" && t.trim());
        }
      } catch (_) {
        // Some versions might return newline-separated list
        tags = tagsText
          .split(/[\n,]+/)
          .map((t) => t.trim())
          .filter((t) => t);
      }
    }
    return { ok: true, categories, tags };
  } catch (err) {
    return {
      ok: false,
      error: "request_failed",
      message: err.message,
    };
  }
}
