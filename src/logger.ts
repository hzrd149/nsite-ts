import debug from "debug";

// enable default logging
if (!debug.enabled("nsite")) debug.enable("nsite,nsite:*");

const logger = debug("nsite");

export default logger;
