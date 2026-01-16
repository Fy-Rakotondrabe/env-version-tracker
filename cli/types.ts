export interface Config {
  storage: "local" | "remote";
  storagePath?: string | null;
  storageUrl?: string | null;
  storageDatabase?: string | null;
  storageCollection?: string | null;
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
