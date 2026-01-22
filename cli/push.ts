import { execSync } from "child_process";
import * as crypto from "crypto";
import { loadConfig } from "./config";
import { LocaleStorage } from "./storage/locale";
import { MongoStorage } from "./storage/mongo";
import { Config, VersionPayload, PushOptions, Storage } from "./types";

const DEFAULT_VERSION = "1.0.0";

/**
 * Get the .env file path for a specific environment
 */
function getEnvFileForEnvironment(
  config: Config,
  environment: string
): string | null {
  if (config.storage !== "remote") {
    return null;
  }

  const envFiles = config.storageEnvFiles || {};
  const envKey = environment.toLowerCase();

  // Map environment names
  const envMap: Record<string, keyof typeof envFiles> = {
    dev: "dev",
    development: "dev",
    staging: "staging",
    preprod: "preprod",
    prod: "production",
    production: "production",
  };

  const mappedKey = envMap[envKey] || (envKey as keyof typeof envFiles);
  const envFile = envFiles[mappedKey] || config.storageEnvFile; // Legacy fallback

  return envFile || null;
}

function exec(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    const err = error as Error;
    throw new Error(`Command failed: ${command} - ${err.message}`);
  }
}

function incrementVersion(
  currentVersion: string,
  versionTag: string,
  isFirstVersion: boolean = false
): string {
  const parts = currentVersion.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  const [major, minor, patch] = parts;
  const tag = versionTag.toLowerCase();

  if (isFirstVersion) {
    if (tag === "major") {
      return "1.0.0";
    } else if (tag === "minor") {
      return "0.1.0";
    } else if (tag === "patch") {
      return "0.0.1";
    } else {
      return versionTag;
    }
  }

  if (tag === "major") {
    return `${major + 1}.0.0`;
  } else if (tag === "minor") {
    return `${major}.${minor + 1}.0`;
  } else if (tag === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  } else {
    return versionTag;
  }
}

async function getLastSavedVersion(
  config: Config,
  environment: string
): Promise<VersionPayload | null> {
  let storage: Storage | null = null;
  try {
    if (config.storage === "local") {
      storage = new LocaleStorage(config);
      return await storage.getVersionByEnvironment(environment);
    }

    if (config.storage === "remote") {
      // Get the env file for this environment
      const envFile = getEnvFileForEnvironment(config, environment);
      if (!envFile) {
        throw new Error(
          `No .env file configured for environment "${environment}"`
        );
      }

      // Create a config with the environment-specific env file
      const envConfig: Config = {
        ...config,
        storageEnvFile: envFile,
      };

      storage = new MongoStorage(envConfig);
      if (storage.init) {
        await storage.init();
      }
      return await storage.getVersionByEnvironment(environment);
    }

    return null;
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to get last saved version: ${err.message}`);
  } finally {
    if (storage && storage.close && typeof storage.close === "function") {
      try {
        await storage.close();
      } catch (closeError) {
        const err = closeError as Error;
        console.error("Warning: Error closing storage:", err.message);
      }
    }
  }
}

export async function push(
  versionTag: string,
  environment: string,
  options: PushOptions = {},
  skipGitPush: boolean = false
): Promise<void> {
  let storage: Storage | null = null;
  try {
    if (!versionTag) {
      throw new Error("Version tag is required");
    }

    if (!environment) {
      throw new Error("Environment is required");
    }

    // Validation: Ne pas faire git push en premier, valider d'abord la config
    // Charger et valider la config AVANT le git push

    const config = loadConfig();

    if (!config.storage) {
      throw new Error("Storage not configured. Run 'config' command first.");
    }

    // For remote storage, check if env file is configured for this environment
    if (config.storage === "remote") {
      const envFile = getEnvFileForEnvironment(config, environment);

      if (!envFile) {
        const envKey = environment.toLowerCase();
        const envMap: Record<string, string> = {
          dev: "dev",
          development: "dev",
          staging: "staging",
          preprod: "preprod",
          prod: "production",
          production: "production",
        };
        const mappedKey = envMap[envKey] || envKey;

        console.error(
          `\n❌ Error: No .env file configured for environment "${environment}"`
        );
        console.log("\n📝 To configure, run:");
        console.log(
          `  evt config remote --env-file-${mappedKey} <path-to-env-file>`
        );
        console.log("\nExample:");
        console.log(
          `  evt config remote --env-file-${mappedKey} .env.${mappedKey}`
        );
        console.log("\nOr configure for all environments:");
        console.log("  evt config remote --storage-env-file .env");
        process.exit(1);
      }

      // Update config with the environment-specific env file for MongoStorage
      config.storageEnvFile = envFile;
    }

    // Valider le format de version si c'est un semver personnalisé
    const isValidSemver = /^\d+\.\d+\.\d+$/.test(versionTag);
    const isValidTag = ["major", "minor", "patch"].includes(versionTag.toLowerCase());
    
    if (!isValidSemver && !isValidTag) {
      console.error(`\n❌ Error: Invalid version tag "${versionTag}"`);
      console.log("\nValid options:");
      console.log("  - major, minor, patch (auto-increment)");
      console.log("  - Semantic version format: X.Y.Z (e.g., 1.2.3)");
      throw new Error(`Invalid version tag: ${versionTag}`);
    }

    // Valider la dernière version existante
    const lastSavedVersion = await getLastSavedVersion(config, environment);
    const isFirstVersion = !lastSavedVersion;
    
    if (lastSavedVersion) {
      const versionParts = lastSavedVersion.version.split(".").map(Number);
      if (versionParts.length !== 3 || versionParts.some(isNaN)) {
        console.error(
          `\n❌ Error: Corrupted version in storage: "${lastSavedVersion.version}"`
        );
        console.log("\nThe version format must be X.Y.Z (e.g., 1.0.0)");
        console.log("Please fix the version in your storage manually or reset it.");
        throw new Error(`Invalid version format in storage: ${lastSavedVersion.version}`);
      }
    }

    // Maintenant seulement faire le git push si tout est valide
    if (!skipGitPush) {
      const currentBranch = exec(`git branch --show-current`);

      try {
        const remoteBranch = `origin/${currentBranch}`;
        const localCommit = exec(`git rev-parse HEAD`);
        let remoteCommit: string | null = null;

        try {
          remoteCommit = exec(`git rev-parse ${remoteBranch}`);
        } catch (error) {
          remoteCommit = null;
        }

        if (remoteCommit && localCommit === remoteCommit) {
          console.error(
            "\n❌ No changes to push. Local branch is already up-to-date with remote."
          );
          throw new Error("No changes to push");
        }

        console.log("🚀 Pushing to remote...");
        exec(`git push origin ${currentBranch} -u`);
        console.log("✅ Push successful!");
      } catch (error) {
        const err = error as Error;
        if (err.message.includes("No changes to push")) {
          throw err;
        }
        console.log("🚀 Pushing to remote...");
        exec(`git push origin ${currentBranch} -u`);
        console.log("✅ Push successful!");
      }
    }

    const currentVersion = lastSavedVersion
      ? lastSavedVersion.version
      : DEFAULT_VERSION;

    let author: string | null = null;
    const trackAuthor = options.trackAuthor === true;
    if (trackAuthor) {
      try {
        author = exec("git config user.email");
        if (!author) {
          console.warn(
            "\n⚠️  Warning: Git user.email is not configured. Author will not be tracked."
          );
          console.log("To configure git user.email, run:");
          console.log('  git config --global user.email "your.email@example.com"');
        }
      } catch (error) {
        const err = error as Error;
        console.warn("\n⚠️  Warning: Could not get git email:", err.message);
        console.log("To configure git user.email, run:");
        console.log('  git config --global user.email "your.email@example.com"');
      }
    }

    let commitHash: string | null = null;
    let commitMessage: string | null = null;
    try {
      const lastCommit = exec('git log -1 --pretty=format:"%h|%s"');
      const parts = lastCommit.split("|");
      commitHash = parts[0] || null;
      commitMessage = parts.slice(1).join("|") || null;

      if (commitMessage && commitMessage.includes("Merge commit")) {
        const mergeHashMatch = commitMessage.match(/'([a-f0-9]{40})'/);
        if (mergeHashMatch) {
          const mergeHash = mergeHashMatch[1];
          try {
            const originalCommit = exec(
              `git log -1 --pretty=format:"%h|%s" ${mergeHash}`
            );
            const originalParts = originalCommit.split("|");
            commitHash = originalParts[0] || commitHash;
            commitMessage = originalParts.slice(1).join("|") || commitMessage;
          } catch (error) {
            const err = error as Error;
            console.warn(
              "Warning: Could not get original commit info:",
              err.message
            );
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      console.warn("Warning: Could not get git commit info:", err.message);
    }

    const version = incrementVersion(
      currentVersion,
      versionTag,
      isFirstVersion
    );

    const payload: VersionPayload = {
      id: crypto.randomUUID(),
      version,
      environment,
      commitHash,
      commitMessage,
      author,
      createdAt: new Date(),
    };

    if (config.storage === "local") {
      storage = new LocaleStorage(config);
      await storage.saveVersion(payload);
    } else if (config.storage === "remote") {
      storage = new MongoStorage(config);
      if (storage.init) {
        await storage.init();
      }
      await storage.saveVersion(payload);
    } else {
      throw new Error(`Unknown storage type: ${config.storage}`);
    }

    console.log(`Version ${version} pushed to ${environment}`);
  } catch (error) {
    const err = error as Error;
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    if (storage && storage.close && typeof storage.close === "function") {
      try {
        await storage.close();
      } catch (error) {
        const err = error as Error;
        console.error("Warning: Error closing storage:", err.message);
      }
    }
  }
}
