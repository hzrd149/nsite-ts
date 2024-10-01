// SPDX-License-Identifier: CC0-1.0

function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.i2p")) {
    return "PROXY 127.0.0.1:4444; SOCKS5 127.0.0.1:4447";
  }
  if (shExpMatch(host, "*.onion")) {
    return "SOCKS5 127.0.0.1:9050";
  }
  return "DIRECT";
}
