import "dotenv/config";

const NOSTR_RELAYS = process.env.NOSTR_RELAYS?.split(",") ?? [];
const BLOSSOM_SERVERS = process.env.BLOSSOM_SERVERS?.split(",") ?? [];

if (NOSTR_RELAYS.length === 0) throw new Error("Requires at least one relay in NOSTR_RELAYS");
if (BLOSSOM_SERVERS.length === 0) throw new Error("Requires at least one server in BLOSSOM_SERVERS");

export { NOSTR_RELAYS, BLOSSOM_SERVERS };
