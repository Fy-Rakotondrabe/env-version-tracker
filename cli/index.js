const { Command } = require("commander");
const program = new Command();
const { loadConfig, saveConfig } = require("./config");
const { push } = require("./push");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

program
  .name("env-version-tracker")
  .description(
    "A CLI tool to track deployments version across multiple environments"
  )
  .version("1.0.0");

program
  .command("config")
  .description("Configure the tool")
  .argument("<storage>", "The tracking storage to use [local, remote]")
  .option("--storage-path <storage-path>", "The path to the tracking storage")
  .option("--storage-url <storage-url>", "The URL to the tracking storage")
  .option(
    "--storage-database <storage-database>",
    "The database to the tracking storage"
  )
  .option(
    "--storage-collection <storage-collection>",
    "The collection to the tracking storage"
  )
  .action((storage, options) => {
    const config = loadConfig();

    const newConfig = {
      ...config,
      storage,
      ...options,
    };
    saveConfig(newConfig);
    console.log("Configuration saved successfully");
  });

program
  .command("push")
  .description("Push changes to the remote repository")
  .argument("<version-tag>", "The version tag [major, minor, patch, or semver]")
  .argument(
    "<environment>",
    "The environment to push the changes to [dev, staging, preprod, production]"
  )
  .option(
    "--track-author <track-author>",
    "Track the author of the commit [true, false] (default: false)"
  )
  .action((versionTag, environment, options) => {
    push(versionTag, environment, options);
  });

program
  .command("setup-hook")
  .description(
    "Setup Husky git hook for automatic version tracking after git push"
  )
  .action(() => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch (error) {
      console.error("Error: Not a git repository");
      process.exit(1);
    }

    try {
      execSync("npx husky install", { stdio: "inherit" });
    } catch (error) {
      console.warn(
        "Warning: Husky installation may have failed, continuing..."
      );
    }

    const huskyDir = path.join(process.cwd(), ".husky");
    if (!fs.existsSync(huskyDir)) {
      fs.mkdirSync(huskyDir, { recursive: true });
    }

    const hookPath = path.join(huskyDir, "pre-push");
    const handlerPath = path.resolve(
      __dirname,
      "hooks",
      "post-push-handler.js"
    );

    const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

PUSH_ARGS="$@"

git push $PUSH_ARGS
PUSH_EXIT_CODE=$?

if [ $PUSH_EXIT_CODE -eq 0 ]; then
  node "${handlerPath}"
fi

exit $PUSH_EXIT_CODE
`;

    fs.writeFileSync(hookPath, hookContent);
    fs.chmodSync(hookPath, "755");

    console.log("Husky hook installed successfully!");
    console.log(
      "Now when you do 'git push', it will automatically prompt for version tracking."
    );
  });

program
  .command("remove-hook")
  .description("Remove Husky git hook")
  .action(() => {
    try {
      const hookPath = path.join(process.cwd(), ".husky", "pre-push");
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        console.log("Hook removed successfully!");
      } else {
        console.log("Hook not found.");
      }
    } catch (error) {
      console.error("Failed to remove hook:", error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
