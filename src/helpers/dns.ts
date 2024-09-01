import dns from "node:dns";
import { nip19 } from "nostr-tools";

export function getCnameRecords(hostname: string) {
  return new Promise<string[]>((res, rej) => {
    dns.resolveCname(hostname, (err, records) => {
      if (err) rej(err);
      else res(records);
    });
  });
}
export function getTxtRecords(hostname: string) {
  return new Promise<string[][]>((res, rej) => {
    dns.resolveTxt(hostname, (err, records) => {
      if (err) rej(err);
      else res(records);
    });
  });
}

function extractNpubFromHostname(hostname: string) {
  const [npub] = hostname.split(".");

  if (npub.startsWith("npub")) {
    const parsed = nip19.decode(npub);
    if (parsed.type !== "npub") throw new Error("Expected npub");

    return parsed.data;
  }
}

export async function resolveNpubFromHostname(hostname: string) {
  // check if domain contains an npub
  let pubkey = extractNpubFromHostname(hostname);

  if (pubkey) return pubkey;

  if (hostname === "localhost") return undefined;

  // try to get npub from CNAME or TXT records
  try {
    const cnameRecords = await getCnameRecords(hostname);
    for (const cname of cnameRecords) {
      const p = extractNpubFromHostname(cname);
      if (p) return p;
    }
  } catch (error) {}

  try {
    const txtRecords = await getTxtRecords(hostname);

    for (const txt of txtRecords) {
      for (const entry of txt) {
        const p = extractNpubFromHostname(entry);
        if (p) return p;
      }
    }
  } catch (error) {}
}
