import "dotenv/config";
import xbytes from "xbytes";

const LOOKUP_RELAYS = process.env.LOOKUP_RELAYS?.split(",") ?? ["wss://user.kindpag.es/", "wss://purplepag.es/"];
const NOSTR_RELAYS = process.env.NOSTR_RELAYS?.split(",") ?? [];
const BLOSSOM_SERVERS = process.env.BLOSSOM_SERVERS?.split(",") ?? [];

const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE ? xbytes.parseSize(process.env.MAX_FILE_SIZE) : Infinity;

const NGINX_HOST = process.env.NGINX_HOST;
const CACHE_PATH = process.env.CACHE_PATH;

export { NOSTR_RELAYS, LOOKUP_RELAYS, BLOSSOM_SERVERS, MAX_FILE_SIZE, NGINX_HOST, CACHE_PATH };
