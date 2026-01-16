import * as fs from "fs";
import * as path from "path";
import { Config, VersionPayload, Storage } from "../types";

export class LocaleStorage implements Storage {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    if (!this.config.storagePath) {
      throw new Error("Storage path is not configured");
    }
  }

  async saveVersion(payload: VersionPayload): Promise<void> {
    try {
      const dir = path.dirname(this.config.storagePath!);
      fs.mkdirSync(dir, { recursive: true });

      let versions: VersionPayload[] = [];
      if (fs.existsSync(this.config.storagePath!)) {
        const content = fs.readFileSync(this.config.storagePath!, "utf-8");
        versions = JSON.parse(content);
      }

      versions.push(payload);

      fs.writeFileSync(
        this.config.storagePath!,
        JSON.stringify(versions, null, 2)
      );
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to save version: ${err.message}`);
    }
  }

  async getVersionByEnvironment(environment: string): Promise<VersionPayload | null> {
    try {
      if (!fs.existsSync(this.config.storagePath!)) {
        return null;
      }

      const content = fs.readFileSync(this.config.storagePath!, "utf-8");
      const versions: VersionPayload[] = JSON.parse(content);
      
      const environmentVersions = versions
        .filter((version) => version.environment === environment)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return environmentVersions.length > 0 ? environmentVersions[0] : null;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to get version: ${err.message}`);
    }
  }
}
