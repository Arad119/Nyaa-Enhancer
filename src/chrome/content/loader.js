(async () => {
  const { isRssOrXmlPage } = await import(
    chrome.runtime.getURL("content/core/page.js")
  );
  if (isRssOrXmlPage()) return;
  await import(chrome.runtime.getURL("content/index.js"));
})();
