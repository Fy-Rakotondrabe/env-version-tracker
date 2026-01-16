export interface Config {
  storage: "local" | "remote";
  storagePath?: string | null;
  // For remote storage, use envFiles to map each environment to its .env file
  storageEnvFiles?: {
    dev?: string | null;
    staging?: string | null;
    preprod?: string | null;
    production?: string | null;
  };
  // Legacy: single env file (deprecated, kept for backward compatibility)
  storageEnvFile?: string | null;
  // Legacy fields (kept for backward compatibility, but deprecated)
  storageUrl?: string | null;
  storageDatabase?: string | null;
  storageCollection?: string | null;
}

export interface MongoConfig {
  url: string;
  database: string;
  collection: string;
}

export interface VersionPayload {
  id: string;
  version: string;
  environment: string;
  commitHash: string | null;
  commitMessage: string | null;
  author: string | null;
  createdAt: Date;
}

export interface PushOptions {
  trackAuthor?: boolean | string;
}

export interface PushArgs {
  versionTag: string;
  environment: string;
  trackAuthor: boolean;
}

export interface Storage {
  saveVersion(payload: VersionPayload): Promise<void>;
  getVersionByEnvironment(environment: string): Promise<VersionPayload | null>;
  init?(): Promise<void>;
  close?(): Promise<void>;
}
