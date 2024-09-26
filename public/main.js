import { nip19, SimplePool } from "nostr-tools";

const relays = ["wss://relay.damus.io", "wss://nos.lol", "wss://nostr.wine"];
const pool = new SimplePool();

const seen = new Set();
function addSite(event) {
  if (seen.has(event.pubkey)) return;
  seen.add(event.pubkey);

  try {
    const template = document.getElementById("site");
    const site = template.content.cloneNode(true);
    const npub = nip19.npubEncode(event.pubkey);

    site.querySelector("nostr-name").setAttribute("pubkey", event.pubkey);
    site.querySelector("nostr-name").textContent = npub.slice(0, 8);
    site.querySelector("nostr-picture").setAttribute("pubkey", event.pubkey);

    site
      .querySelector(".nsite-link")
      ?.setAttribute("href", new URL("/", `${location.protocol}//${npub}.${location.host}`).toString());
    site.querySelector("time").textContent = new Date(event.created_at * 1000).toDateString();

    document.getElementById("sites").appendChild(site);
  } catch (error) {
    console.log("Failed to add site", event);
    console.log(error);
  }
}

console.log("Loading sites");
pool.subscribeMany(relays, [{ kinds: [34128], "#d": ["/index.html"] }], {
  onevent: addSite,
});
