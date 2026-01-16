import { execSync } from "child_process";
import * as crypto from "crypto";
import { loadConfig } from "./config";
import { LocaleStorage } from "./storage/locale";
import { MongoStorage } from "./storage/mongo";
import { Config, VersionPayload, PushOptions, Storage } from "./types";

const DEFAULT_VERSION = "1.0.0";

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
      storage = new MongoStorage(config);
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
          throw new Error(
            "No changes to push. Local branch is already up-to-date with remote."
          );
        }

        exec(`git push origin ${currentBranch} -u`);
      } catch (error) {
        const err = error as Error;
        if (err.message.includes("No changes to push")) {
          throw err;
        }
        exec(`git push origin ${currentBranch} -u`);
      }
    }

    const config = loadConfig();

    if (!config.storage) {
      throw new Error("Storage not configured. Run 'config' command first.");
    }

    const lastSavedVersion = await getLastSavedVersion(config, environment);
    const isFirstVersion = !lastSavedVersion;
    const currentVersion = lastSavedVersion
      ? lastSavedVersion.version
      : DEFAULT_VERSION;

    let author: string | null = null;
    const trackAuthor =
      options.trackAuthor === "true" || options.trackAuthor === true;
    if (trackAuthor) {
      try {
        author = exec("git config user.email");
      } catch (error) {
        const err = error as Error;
        console.warn("Warning: Could not get git email:", err.message);
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
