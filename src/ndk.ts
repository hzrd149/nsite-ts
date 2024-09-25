import NDK from "@nostr-dev-kit/ndk";
import { LOOKUP_RELAYS, NOSTR_RELAYS } from "./env.js";

const ndk = new NDK({
  explicitRelayUrls: [...LOOKUP_RELAYS, ...NOSTR_RELAYS],
});

ndk.connect();

export async function getUserOutboxes(pubkey: string) {
  const mailboxes = await ndk.fetchEvent({ kinds: [10002], authors: [pubkey] });
  if (!mailboxes) return;

  return mailboxes.tags.filter((t) => t[0] === "r" && (t[2] === undefined || t[2] === "write")).map((t) => t[1]);
}

export default ndk;
