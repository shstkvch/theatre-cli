#!/usr/bin/env node

import { main } from "../src/cli.js";

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
});

main(process.argv.slice(2)).catch((error) => {
  console.error(`theatre: ${error.message}`);
  if (error.hint) console.error(error.hint);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = error.exitCode || 1;
});
