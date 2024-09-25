import { nip19, SimplePool } from "nostr-tools";

const seen = new Set();
function addSite(event) {
  if (seen.has(event.pubkey)) return;
  seen.add(event.pubkey);

  try {
    const template = document.getElementById("site");
    const site = template.content.cloneNode(true);
    const npub = nip19.npubEncode(event.pubkey);

    site.querySelector(".pubkey").textContent = npub;
    site.querySelector(".link").href = new URL("/", `${location.protocol}//${npub}.${location.host}`).toString();

    document.getElementById("sites").appendChild(site);
  } catch (error) {
    console.log("Failed to add site", event);
    console.log(error);
  }
}

const pool = new SimplePool();

console.log("Loading sites");
pool.subscribeMany(
  ["wss://relay.damus.io", "wss://nos.lol", "wss://nostr.wine"],
  [{ kinds: [34128], "#d": ["/index.html"] }],
  {
    onevent: addSite,
  },
);
