export function fetchUrlViaBackground(url) {
  return new Promise((resolve) => {
    browser.runtime.sendMessage({ type: "fetchUrl", url }, resolve);
  });
}

export function fetchJsonRequestViaBackground({
  url,
  method = "GET",
  body,
  headers,
} = {}) {
  return new Promise((resolve) => {
    browser.runtime.sendMessage(
      { type: "fetchJson", url, method, body, headers },
      resolve,
    );
  });
}

export async function fetchJsonViaBackground(url) {
  const result = await fetchUrlViaBackground(url);
  if (!result?.ok) {
    return { ok: false, error: result?.error || "Request failed" };
  }
  try {
    return { ok: true, data: JSON.parse(result.text) };
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }
}
