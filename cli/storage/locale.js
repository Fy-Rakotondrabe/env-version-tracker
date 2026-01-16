const fs = require("fs");
const path = require("path");

class LocaleStorage {
  constructor(config) {
    this.config = config;
    if (!this.config.storagePath) {
      throw new Error("Storage path is not configured");
    }
  }

  async saveVersion(payload) {
    try {
      const dir = path.dirname(this.config.storagePath);
      fs.mkdirSync(dir, { recursive: true });

      let versions = [];
      if (fs.existsSync(this.config.storagePath)) {
        const content = fs.readFileSync(this.config.storagePath, "utf-8");
        versions = JSON.parse(content);
      }

      const existingIndex = versions.findIndex(
        (v) => v.environment === payload.environment
      );

      if (existingIndex >= 0) {
        versions[existingIndex] = payload;
      } else {
        versions.push(payload);
      }

      fs.writeFileSync(
        this.config.storagePath,
        JSON.stringify(versions, null, 2)
      );
    } catch (error) {
      throw new Error(`Failed to save version: ${error.message}`);
    }
  }

  async getVersionByEnvironment(environment) {
    try {
      if (!fs.existsSync(this.config.storagePath)) {
        return null;
      }

      const content = fs.readFileSync(this.config.storagePath, "utf-8");
      const versions = JSON.parse(content);
      return (
        versions.find((version) => version.environment === environment) || null
      );
    } catch (error) {
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }
}

module.exports = { LocaleStorage };
