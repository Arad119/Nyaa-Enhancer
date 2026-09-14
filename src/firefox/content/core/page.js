export function isRssOrXmlPage() {
  if (typeof XMLDocument !== "undefined" && document instanceof XMLDocument) {
    return true;
  }

  const contentType = String(document.contentType || "").toLowerCase();
  if (contentType && !contentType.includes("html")) {
    return true;
  }

  const root = document.documentElement?.localName?.toLowerCase();
  if (root === "rss" || root === "feed") {
    return true;
  }

  return new URLSearchParams(window.location.search).get("page") === "rss";
}

export function getPageFlags() {
  const path = window.location.pathname;
  const isRss = isRssOrXmlPage();
  return {
    path,
    isRss,
    isList: !isRss && (path === "/" || path === "" || path.startsWith("/user/")),
    isView: !isRss && path.startsWith("/view/"),
    isUser: !isRss && path.startsWith("/user/"),
    isSettings: !isRss && path === "/settings",
    isChangelog: !isRss && path === "/changelog",
    isHistory: !isRss && path === "/history",
  };
}
