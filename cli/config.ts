import * as path from "path";
import * as fs from "fs";
import { Config } from "./types";

function getConfigDir(): string {
  const projectRoot = process.cwd();
  return path.join(projectRoot, ".env-version-tracker");
}

function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

const DEFAULT_CONFIG: Config = {
  storage: "local",
  storagePath: null,
  storageUrl: null,
  storageDatabase: null,
  storageCollection: null,
};

export function loadConfig(): Config {
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
    const err = error as Error;
    console.error("Error loading config:", err.message);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Config): void {
  try {
    const configDir = getConfigDir();
    const configFile = getConfigFile();
    
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to save config: ${err.message}`);
  }
}
