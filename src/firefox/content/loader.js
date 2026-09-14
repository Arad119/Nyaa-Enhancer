(async () => {
  const { isRssOrXmlPage } = await import(
    browser.runtime.getURL("content/core/page.js")
  );
  if (isRssOrXmlPage()) return;
  await import(browser.runtime.getURL("content/index.js"));
})();
