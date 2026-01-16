#!/usr/bin/env node

const { push } = require("../push");
const { promptForPushArgs } = require("../prompts");

async function main() {
  try {
    console.log("\nPush successful! Tracking version...\n");

    const args = await promptForPushArgs();

    await push(
      args.versionTag,
      args.environment,
      { trackAuthor: args.trackAuthor },
      true
    );

    console.log("\nVersion tracking completed!\n");
  } catch (error) {
    console.error("\nError tracking version:", error.message);
    process.exit(1);
  }
}

main();
