#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.js";
import { push } from "./push.js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promptForPushArgs } from "./prompts.js";
import { Config } from "./types.js";
import { printEnvFileInstructions } from "./env-loader.js";

const program = new Command();

program
  .name("evt")
  .description(
    "A CLI tool to track deployments version across multiple environments"
  )
  .version("1.0.0");

program
  .command("config")
  .description("Configure the tool")
  .argument("<storage>", "The tracking storage to use [local, remote]")
  .option(
    "--storage-path <storage-path>",
    "The path to the tracking storage (for local)"
  )
  .option(
    "--storage-env-file <storage-env-file>",
    "Path to .env file containing MongoDB configuration (for remote)"
  )
  // Legacy options (deprecated, kept for backward compatibility)
  .option(
    "--storage-url <storage-url>",
    "The URL to the tracking storage (deprecated)"
  )
  .option(
    "--storage-database <storage-database>",
    "The database to the tracking storage (deprecated)"
  )
  .option(
    "--storage-collection <storage-collection>",
    "The collection to the tracking storage (deprecated)"
  )
  .action((storage: string, options: Partial<Config>) => {
    const config = loadConfig();
    const storageType = storage as "local" | "remote";

    if (storageType === "remote") {
      // For remote storage, prefer env file
      if (options.storageEnvFile) {
        const newConfig: Config = {
          ...config,
          storage: storageType,
          storageEnvFile: options.storageEnvFile,
          // Clear legacy values when using env file
          storageUrl: null,
          storageDatabase: null,
          storageCollection: null,
        };
        saveConfig(newConfig);
        console.log("✅ Configuration saved successfully!");
        console.log(`\n📄 Using environment file: ${options.storageEnvFile}`);
        console.log(
          "\n⚠️  Make sure your .env file contains the required variables:"
        );
        printEnvFileInstructions();
      } else if (options.storageUrl) {
        // Legacy support: direct values
        console.warn(
          "\n⚠️  Warning: Direct configuration is deprecated. Please use --storage-env-file instead."
        );
        const newConfig: Config = {
          ...config,
          storage: storageType,
          storageUrl: options.storageUrl,
          storageDatabase: options.storageDatabase || null,
          storageCollection: options.storageCollection || null,
          storageEnvFile: null,
        };
        saveConfig(newConfig);
        console.log("Configuration saved successfully (legacy mode)");
      } else {
        console.error(
          "\n❌ Error: For remote storage, you must provide --storage-env-file"
        );
        console.log("\nExample:");
        console.log("  evt config remote --storage-env-file .env");
        console.log("\nRequired environment variables:");
        printEnvFileInstructions();
        process.exit(1);
      }
    } else {
      // Local storage
      const newConfig: Config = {
        ...config,
        storage: storageType,
        storagePath: options.storagePath || null,
        // Clear remote config when switching to local
        storageEnvFile: null,
        storageUrl: null,
        storageDatabase: null,
        storageCollection: null,
      };
      saveConfig(newConfig);
      console.log("✅ Configuration saved successfully!");
      if (!options.storagePath) {
        console.warn(
          "\n⚠️  Warning: No storage path provided. Please set it with --storage-path"
        );
      }
    }
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
  .action(
    (
      versionTag: string,
      environment: string,
      options: { trackAuthor?: string }
    ) => {
      push(versionTag, environment, options);
    }
  );

program
  .command("post-push-handler")
  .description("Internal command called by git hook after successful push")
  .action(async () => {
    try {
      console.log("\n🚀 Post-push handler triggered!");
      console.log("Tracking version...\n");

      const args = await promptForPushArgs();

      await push(
        args.versionTag,
        args.environment,
        { trackAuthor: args.trackAuthor.toString() },
        true
      );

      console.log("\n✅ Version tracking completed!\n");
    } catch (error) {
      const err = error as Error;
      console.error("\n❌ Error tracking version:", err.message);
      process.exit(1);
    }
  });

program
  .command("setup-hook")
  .description("Setup git hook for automatic version tracking after git push")
  .action(() => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch (error) {
      console.error("❌ Error: Not a git repository");
      process.exit(1);
    }

    const gitDir = execSync("git rev-parse --git-dir", {
      encoding: "utf-8",
    }).trim();

    const hooksDir = path.join(gitDir, "hooks");
    const postPushHook = path.join(hooksDir, "post-push");
    const configDir = path.join(process.cwd(), ".env-version-tracker");

    // Créer le dossier de config si nécessaire
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // S'assurer que le dossier hooks existe
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Git n'a pas de hook post-push natif, on utilise pre-push + state file
    // OU on crée un alias custom
    const aliasName = "ppush";
    const wrapperScript = path.join(configDir, "git-push-wrapper.sh");

    const scriptContent = `#!/usr/bin/env bash
set -e

LOG_FILE="/tmp/evt-debug.log"
echo "=== Git Push Wrapper Started at $(date) ===" >> "$LOG_FILE"
echo "Command: git push $@" >> "$LOG_FILE"
echo "PWD: $(pwd)" >> "$LOG_FILE"

# Exécuter le vrai git push
command git push "$@"
PUSH_EXIT_CODE=$?

echo "Push exit code: $PUSH_EXIT_CODE" >> "$LOG_FILE"

if [ $PUSH_EXIT_CODE -eq 0 ]; then
  echo "✅ Push successful, running post-push handler..." | tee -a "$LOG_FILE"
  
  PROJECT_DIR="$(git rev-parse --show-toplevel)"
  echo "Project dir: $PROJECT_DIR" >> "$LOG_FILE"
  
  # Chercher le CLI
  if [ -f "$PROJECT_DIR/node_modules/.bin/evt" ]; then
    echo "Using local CLI" >> "$LOG_FILE"
    "$PROJECT_DIR/node_modules/.bin/evt" post-push-handler
  elif command -v npx >/dev/null 2>&1; then
    echo "Using npx" >> "$LOG_FILE"
    npx evt post-push-handler
  elif command -v evt >/dev/null 2>&1; then
    echo "Using global CLI" >> "$LOG_FILE"
    evt post-push-handler
  else
    echo "⚠️  evt not found" | tee -a "$LOG_FILE"
  fi
else
  echo "❌ Push failed" >> "$LOG_FILE"
fi

echo "=== Wrapper Ended ===" >> "$LOG_FILE"
exit $PUSH_EXIT_CODE
`;

    fs.writeFileSync(wrapperScript, scriptContent);
    fs.chmodSync(wrapperScript, "755");

    try {
      const absoluteScriptPath = path.resolve(wrapperScript);

      // Option 1: Créer un alias 'ppush' (nom différent pour éviter conflits)
      execSync(
        `git config --local alias.${aliasName} '!${absoluteScriptPath}'`,
        {
          stdio: "pipe",
        }
      );

      console.log(`✅ Git alias '${aliasName}' configured successfully!`);
      console.log(`   Script: ${absoluteScriptPath}`);
      console.log(`\n📝 Usage: git ${aliasName} [options]`);
      console.log(`   Example: git ${aliasName} origin main`);
      console.log(`\n💡 Or set 'push' as alias (may conflict):`);
      console.log(`   git config --local alias.push '!${absoluteScriptPath}'`);
      console.log(`\n🔍 Debug logs: /tmp/evt-debug.log`);

      // Vérifier l'alias
      const verify = execSync(`git config --local alias.${aliasName}`, {
        encoding: "utf-8",
      });
      console.log(`\n✓ Alias verified: ${verify.trim()}`);

      // Test syntaxe
      execSync(`bash -n ${absoluteScriptPath}`, { stdio: "pipe" });
      console.log("✓ Script syntax valid");

      console.log(`\n🚀 Quick test:`);
      console.log(`   git ${aliasName} --dry-run origin main`);

      // Option pour créer aussi l'alias 'push'
      console.log(`\n❓ Want to override 'git push' instead?`);
      console.log(
        `   Run: git config --local alias.push '!${absoluteScriptPath}'`
      );
      console.log(
        `   Warning: This may cause conflicts. Use 'git ${aliasName}' to be safe.`
      );
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error creating alias:", err.message);
      process.exit(1);
    }
  });

program
  .command("setup-push-alias")
  .description(
    "Override 'git push' with version tracking (may cause conflicts)"
  )
  .action(() => {
    try {
      const configDir = path.join(process.cwd(), ".env-version-tracker");
      const wrapperScript = path.join(configDir, "git-push-wrapper.sh");

      if (!fs.existsSync(wrapperScript)) {
        console.error("❌ Error: Run 'setup-hook' first");
        process.exit(1);
      }

      const absoluteScriptPath = path.resolve(wrapperScript);

      execSync(`git config --local alias.push '!${absoluteScriptPath}'`, {
        stdio: "pipe",
      });

      console.log("✅ Git 'push' alias configured!");
      console.log("⚠️  Warning: 'git push' is now overridden");
      console.log("   To revert: git config --local --unset alias.push");
    } catch (error) {
      const err = error as Error;
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  });

program
  .command("remove-hook")
  .description("Remove git alias")
  .action(() => {
    const aliases = ["push", "ppush"];
    let removed = false;

    for (const alias of aliases) {
      try {
        execSync(`git config --local --unset alias.${alias}`, {
          stdio: "pipe",
        });
        console.log(`✅ Git alias '${alias}' removed`);
        removed = true;
      } catch (error) {
        // Alias doesn't exist, continue
      }
    }

    if (!removed) {
      console.log("ℹ️  No aliases found to remove");
    }
  });

program.parse(process.argv);
