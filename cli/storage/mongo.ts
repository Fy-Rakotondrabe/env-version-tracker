import { MongoClient, Db } from "mongodb";
import { Config, VersionPayload, Storage } from "../types";
import { loadMongoConfig } from "../env-loader";

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;
let connectionPromise: Promise<void> | null = null;
let connectionConfig: string | null = null;

async function closeConnection(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.close();
    } catch (error) {
      // Ignore errors on close
    } finally {
      clientInstance = null;
      dbInstance = null;
      connectionPromise = null;
      connectionConfig = null;
    }
  }
}

process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("exit", async () => {
  await closeConnection();
});

export class MongoStorage implements Storage {
  private config: Config;
  private mongoConfig?: { url: string; database: string; collection: string };

  constructor(config: Config) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (connectionPromise) {
      await connectionPromise;
      return;
    }

    if (this._isConnected()) {
      return;
    }

    connectionPromise = this._connect();
    await connectionPromise;
  }

  private _isConnected(): boolean {
    try {
      return (
        clientInstance !== null &&
        dbInstance !== null
      );
    } catch {
      return false;
    }
  }

  private async _connect(): Promise<void> {
    try {
      // Load config from .env file if available, otherwise use legacy config
      let mongoConfig;
      if (this.config.storageEnvFile) {
        mongoConfig = loadMongoConfig(this.config.storageEnvFile);
      } else if (this.config.storageUrl) {
        // Legacy support: use direct config values
        mongoConfig = {
          url: this.config.storageUrl,
          database: this.config.storageDatabase || "version-tracker",
          collection: this.config.storageCollection || "versions",
        };
      } else {
        throw new Error(
          "MongoDB configuration not found. Please configure using 'evt config remote --storage-env-file <path>'"
        );
      }

      const configKey = `${mongoConfig.url}:${mongoConfig.database}`;
      if (this._isConnected() && connectionConfig === configKey) {
        return;
      }

      if (clientInstance) {
        try {
          await clientInstance.close();
        } catch (error) {
          // Ignore errors on close
        }
      }

      const client = new MongoClient(mongoConfig.url, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await client.connect();
      clientInstance = client;
      connectionConfig = configKey;
      dbInstance = client.db(mongoConfig.database);
      this.mongoConfig = mongoConfig; // Store for later use
    } catch (error) {
      connectionPromise = null;
      clientInstance = null;
      dbInstance = null;
      connectionConfig = null;
      const err = error as Error;
      throw new Error(`Failed to connect to MongoDB: ${err.message}`);
    }
  }

  private async _ensureConnection(): Promise<void> {
    if (!this._isConnected()) {
      connectionPromise = null;
      await this.init();
    }
  }

  get db(): Db {
    if (!dbInstance) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return dbInstance;
  }

  async close(): Promise<void> {
    if (clientInstance && this._isConnected()) {
      try {
        await clientInstance.close();
      } catch (error) {
        const err = error as Error;
        console.error("Error closing MongoDB connection:", err.message);
      } finally {
        clientInstance = null;
        dbInstance = null;
        connectionPromise = null;
        connectionConfig = null;
      }
    }
  }

  async saveVersion(payload: VersionPayload): Promise<void> {
    await this._ensureConnection();
    const collectionName =
      this.mongoConfig?.collection ||
      this.config.storageCollection ||
      "versions";
    const collection = this.db.collection(collectionName);
    await collection.insertOne(payload);
  }

  async getVersionByEnvironment(environment: string): Promise<VersionPayload | null> {
    await this._ensureConnection();
    const collectionName =
      this.mongoConfig?.collection ||
      this.config.storageCollection ||
      "versions";
    const collection = this.db.collection<VersionPayload>(collectionName);
    const result = await collection
      .find({ environment })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
    return result as VersionPayload | null;
  }
}
