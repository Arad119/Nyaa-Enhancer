export const NYAA_DOMAINS = [
  "nyaa.si",
  "nya.iss.one",
  "nyaa.ink",
  "nyaa.land",
  "nyaa.digital",
  "ny.iss.one",
];

export const NYAA_MATCHES = NYAA_DOMAINS.map((domain) => `*://*.${domain}/*`);

export const NYAA_SETTINGS_EXTENSION_PATH = "pages/settings/index.html";

export function isNyaaSite(url) {
  return NYAA_DOMAINS.some((domain) => url?.includes(domain));
}

export function isExtensionPage() {
  return typeof location !== "undefined" && location.protocol === "browser-extension:";
}

export function getNyaaSettingsExtensionUrl() {
  return browser.runtime.getURL(NYAA_SETTINGS_EXTENSION_PATH);
}

export async function queryNyaaTabs() {
  try {
    return await browser.tabs.query({ url: NYAA_MATCHES });
  } catch {
    return [];
  }
}

export async function sendMessageToNyaaTabs(message, { excludeTabId } = {}) {
  const tabs = await queryNyaaTabs();
  await Promise.all(
    tabs.map((tab) => {
      if (!tab?.id || tab.id === excludeTabId) return Promise.resolve();
      return browser.tabs.sendMessage(tab.id, message).catch(() => {});
    }),
  );
}

export async function resolveNyaaSettingsTarget() {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  if (active?.url && isNyaaSite(active.url)) {
    return {
      url: `${new URL(active.url).origin}/settings`,
      tabId: active.id,
      sameTab: true,
    };
  }

  const nyaaTabs = await queryNyaaTabs();
  const existing = nyaaTabs.find((tab) => tab.url);
  if (existing?.url) {
    return {
      url: `${new URL(existing.url).origin}/settings`,
      tabId: null,
      sameTab: false,
    };
  }

  return {
    url: getNyaaSettingsExtensionUrl(),
    tabId: null,
    sameTab: false,
  };
}
