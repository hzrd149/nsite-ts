import { ProxyAgent } from "proxy-agent";
import { getProxyForUrl } from "proxy-from-env";

const agent = new ProxyAgent({ keepAlive: true });

if (getProxyForUrl("http://example.onion")) {
  console.log("Tor connections enabled");
}
if (getProxyForUrl("http://example.i2p")) {
  console.log("I2P connections enabled");
}

export default agent;
