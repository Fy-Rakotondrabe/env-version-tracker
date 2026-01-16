export interface Config {
  storage: "local" | "remote";
  storagePath?: string | null;
  // For remote storage, use envFile instead of direct values
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
