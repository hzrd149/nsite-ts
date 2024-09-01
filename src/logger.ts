import debug from "debug";

if (!process.env.DEBUG) debug.enable("nsite, nsite:*");

const logger = debug("nsite");

export default logger;
