import NDK from "@nostr-dev-kit/ndk";
import { NOSTR_RELAYS } from "./env.js";

const ndk = new NDK({
  explicitRelayUrls: NOSTR_RELAYS,
});

ndk.connect();

export default ndk;
