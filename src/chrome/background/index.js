import { initBadgeListeners } from "./badge.js";
import { initMessageProxy } from "./fetch-proxy.js";
import { bindProbeAlternateClients } from "./torrent-clients/detect.js";
import { probeDelugeRpc } from "./torrent-clients/deluge.js";
import { probeQbtVersion } from "./torrent-clients/qbittorrent.js";
import { probeTransmissionRpc } from "./torrent-clients/transmission.js";

bindProbeAlternateClients(async (baseUrl, except) => {
  if (except !== "qbittorrent") {
    const qbt = await probeQbtVersion(baseUrl);
    if (qbt) return qbt;
  }
  if (except !== "deluge") {
    const deluge = await probeDelugeRpc(baseUrl);
    if (deluge) return deluge;
  }
  if (except !== "transmission") {
    const transmission = await probeTransmissionRpc(baseUrl);
    if (transmission) return transmission;
  }
  return null;
});

initBadgeListeners();
initMessageProxy();
