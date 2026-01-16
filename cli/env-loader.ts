import * as fs from "fs";
import * as path from "path";
import { MongoConfig } from "./types";

/**
 * Load environment variables from a .env file
 */
export function loadEnvFile(envFilePath: string): Record<string, string> {
  const fullPath = path.isAbsolute(envFilePath)
    ? envFilePath
    : path.resolve(process.cwd(), envFilePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Environment file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=VALUE format
    const match = trimmed.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  }

  return env;
}

/**
 * Load database configuration from environment variables
 * Uses generic variable names to support multiple database providers
 */
export function loadMongoConfig(envFilePath: string): MongoConfig {
  const env = loadEnvFile(envFilePath);

  // Use generic variable names (provider-agnostic)
  // Support legacy MongoDB-specific names for backward compatibility
  const url = env.DATABASE_URL || env.DATABASE_URI || env.DB_URL || env.DB_URI;

  const database = env.DATABASE_NAME || env.DATABASE || env.DB_NAME || env.DB;

  const collection =
    env.COLLECTION_NAME || env.COLLECTION || env.TABLE_NAME || env.TABLE;

  if (!url) {
    throw new Error(
      "Database URL not found in environment file. " + "Please set DATABASE_URL"
    );
  }

  if (!database) {
    throw new Error(
      "Database name not found in environment file. " +
        "Please set DATABASE_NAME"
    );
  }

  if (!collection) {
    throw new Error(
      "Collection/Table name not found in environment file. " +
        "Please set COLLECTION_NAME"
    );
  }

  return {
    url,
    database,
    collection,
  };
}

/**
 * Display information about required environment variables
 */
export function printEnvFileInstructions(): void {
  console.log("\n📝 Required environment variables in your .env file:\n");
  console.log("  # Database Connection URL");
  console.log("  DATABASE_URL=mongodb://localhost:27017");
  console.log("  # Or use: DATABASE_URI, DB_URL, DB_URI\n");

  console.log("  # Database Name");
  console.log("  DATABASE_NAME=version-tracker");
  console.log("  # Or use: DATABASE, DB_NAME, DB\n");

  console.log("  # Collection/Table Name");
  console.log("  COLLECTION_NAME=versions");
  console.log("  # Or use: COLLECTION, TABLE_NAME, TABLE\n");

  console.log("💡 Example .env file:");
  console.log("  DATABASE_URL=mongodb://localhost:27017");
  console.log("  DATABASE_NAME=version-tracker");
  console.log("  COLLECTION_NAME=versions\n");
}
