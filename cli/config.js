const envPaths = require("env-paths");
const path = require("path");
const fs = require("fs");

const paths = envPaths("env-version-tracker");
const configFile = path.join(paths.config, "config.json");

const DEFAULT_CONFIG = {
  storage: "local",
  storagePath: null,
  storageUrl: null,
  storageDatabase: null,
  storageCollection: null,
};

function loadConfig() {
  if (!fs.existsSync(configFile)) {
    return DEFAULT_CONFIG;
  }

  try {
    return {
      ...DEFAULT_CONFIG,
      ...JSON.parse(fs.readFileSync(configFile, "utf-8")),
    };
  } catch (error) {
    console.error("Error loading config:", error.message);
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config) {
  try {
    fs.mkdirSync(paths.config, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

module.exports = { loadConfig, saveConfig };
