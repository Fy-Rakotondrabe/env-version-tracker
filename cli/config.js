const path = require("path");
const fs = require("fs");

function getConfigDir() {
  const projectRoot = process.cwd();
  return path.join(projectRoot, ".env-version-tracker");
}

function getConfigFile() {
  return path.join(getConfigDir(), "config.json");
}

const DEFAULT_CONFIG = {
  storage: "local",
  storagePath: null,
  storageUrl: null,
  storageDatabase: null,
  storageCollection: null,
};

function loadConfig() {
  const configFile = getConfigFile();
  
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
    const configDir = getConfigDir();
    const configFile = getConfigFile();
    
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

module.exports = { loadConfig, saveConfig };
