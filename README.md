# nsite-ts

A Typescript implementation of [nsite](https://github.com/lez/nsite)

## Running with docker-compose

```sh
git clone https://github.com/hzrd149/nsite-ts.git
cd nsite-ts
docker compose up
```

Once the service is running you can access the cached version at `http://localhost:8080`

If you need to test, you can directly access the ts server at `http://localhost:3000`

## Connecting to Tor and I2P relays

nsite-ts supports `ALL_PROXY` and other proxy env variables [here](https://www.npmjs.com/package/proxy-from-env#environment-variables)

Install Tor ([Documentation](https://community.torproject.org/onion-services/setup/install/)) and I2Pd ([Documentation](https://i2pd.readthedocs.io/en/latest/user-guide/install/))

Create a proxy.pac file

```txt
// SPDX-License-Identifier: CC0-1.0

function FindProxyForURL(url, host)
{
  if (shExpMatch(host, "*.i2p"))
  {
    return "PROXY 127.0.0.1:4444; SOCKS5 127.0.0.1:4447";
  }
  if (shExpMatch(host, "*.onion"))
  {
    return "SOCKS5 127.0.0.1:9050";
  }
  return "DIRECT";
}
```

Start server with `PAC_PROXY` variable

```sh
PAC_PROXY=file://$(pwd)/proxy.pac node .
```
