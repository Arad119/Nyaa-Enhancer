(async () => {
  await import(browser.runtime.getURL("content/index.js"));
})();
