import "dotenv/config";
import xbytes from "xbytes";

const NOSTR_RELAYS = process.env.NOSTR_RELAYS?.split(",") ?? [];
const BLOSSOM_SERVERS = process.env.BLOSSOM_SERVERS?.split(",") ?? [];

const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE ? xbytes.parseSize(process.env.MAX_FILE_SIZE) : Infinity;

if (NOSTR_RELAYS.length === 0) throw new Error("Requires at least one relay in NOSTR_RELAYS");

export { NOSTR_RELAYS, BLOSSOM_SERVERS, MAX_FILE_SIZE };
