const { execSync } = require("child_process");
const { loadConfig } = require("./config");
const { LocaleStorage } = require("./storage/locale");
const { MongoStorage } = require("./storage/mongo");

const DEFAULT_VERSION = "1.0.0";

function exec(command) {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command} - ${error.message}`);
  }
}

function incrementVersion(currentVersion, versionTag) {
  const parts = currentVersion.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  const [major, minor, patch] = parts;
  const tag = versionTag.toLowerCase();

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

async function getLastSavedVersion(config, environment) {
  let storage = null;
  try {
    if (config.storage === "local") {
      storage = new LocaleStorage(config);
      return await storage.getVersionByEnvironment(environment);
    }

    if (config.storage === "remote") {
      storage = new MongoStorage(config);
      await storage.init();
      return await storage.getVersionByEnvironment(environment);
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to get last saved version: ${error.message}`);
  } finally {
    if (storage && storage.close && typeof storage.close === "function") {
      try {
        await storage.close();
      } catch (closeError) {
        console.error("Warning: Error closing storage:", closeError.message);
      }
    }
  }
}

async function push(versionTag, environment, options = {}, skipGitPush = false) {
  let storage = null;
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
        let remoteCommit = null;

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

        exec(`git push origin ${currentBranch}`);
      } catch (error) {
        if (error.message.includes("No changes to push")) {
          throw error;
        }
        exec(`git push origin ${currentBranch}`);
      }
    }

    const config = loadConfig();

    if (!config.storage) {
      throw new Error("Storage not configured. Run 'config' command first.");
    }

    const lastSavedVersion = await getLastSavedVersion(config, environment);
    const currentVersion = lastSavedVersion
      ? lastSavedVersion.version
      : DEFAULT_VERSION;

    let author = null;
    const trackAuthor =
      options.trackAuthor === "true" || options.trackAuthor === true;
    if (trackAuthor) {
      try {
        author = exec("git config user.email");
      } catch (error) {
        console.warn("Warning: Could not get git email:", error.message);
      }
    }

    let commitHash = null;
    let commitMessage = null;
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
            console.warn(
              "Warning: Could not get original commit info:",
              error.message
            );
          }
        }
      }
    } catch (error) {
      console.warn("Warning: Could not get git commit info:", error.message);
    }

    const version = incrementVersion(currentVersion, versionTag);

    const payload = {
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
      await storage.init();
      await storage.saveVersion(payload);
    } else {
      throw new Error(`Unknown storage type: ${config.storage}`);
    }

    console.log(`Version ${version} pushed to ${environment}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    if (storage && storage.close && typeof storage.close === "function") {
      try {
        await storage.close();
      } catch (error) {
        console.error("Warning: Error closing storage:", error.message);
      }
    }
  }
}

module.exports = { push };
