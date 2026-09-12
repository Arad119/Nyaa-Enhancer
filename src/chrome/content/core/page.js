export function getPageFlags() {
  const path = window.location.pathname;
  return {
    path,
    isList: path === "/" || path === "" || path.startsWith("/user/"),
    isView: path.startsWith("/view/"),
    isUser: path.startsWith("/user/"),
    isSettings: path === "/settings",
    isChangelog: path === "/changelog",
  };
}
