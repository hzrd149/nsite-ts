import { ProxyAgent } from "proxy-agent";
import { PacProxyAgent } from "pac-proxy-agent";
import { I2P_PROXY, PAC_PROXY, TOR_PROXY } from "./env.js";

function buildPacURI() {
  const statements: string[] = [];

  if (I2P_PROXY) {
    statements.push(
      `
if (shExpMatch(host, "*.i2p"))
{
return "SOCKS5 ${I2P_PROXY}";
}
`.trim(),
    );
  }

  if (TOR_PROXY) {
    statements.push(
      `
if (shExpMatch(host, "*.onion"))
{
return "SOCKS5 ${TOR_PROXY}";
}
`.trim(),
    );
  }

  statements.push('return "DIRECT";');

  const PACFile = `
// SPDX-License-Identifier: CC0-1.0

function FindProxyForURL(url, host)
{
${statements.join("\n")}
}
`.trim();

  return "pac+data:application/x-ns-proxy-autoconfig;base64," + btoa(PACFile);
}
function buildProxy() {
  if (PAC_PROXY) {
    console.log(`Using PAC proxy file`);
    return new PacProxyAgent(PAC_PROXY);
  } else if (TOR_PROXY || I2P_PROXY) {
    if (TOR_PROXY) console.log("Tor connection enabled");
    if (I2P_PROXY) console.log("I2P connection enabled");

    return new PacProxyAgent(buildPacURI());
  } else return new ProxyAgent({ keepAlive: true });
}

const agent = buildProxy();

export default agent;
