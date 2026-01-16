const { MongoClient } = require("mongodb");

let clientInstance = null;
let dbInstance = null;
let connectionPromise = null;
let connectionConfig = null;

async function closeConnection() {
  if (clientInstance) {
    try {
      await clientInstance.close();
    } catch (error) {
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

class MongoStorage {
  constructor(config) {
    this.config = config;
  }

  async init() {
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

  _isConnected() {
    return (
      clientInstance &&
      clientInstance.topology &&
      clientInstance.topology.isConnected()
    );
  }

  async _connect() {
    try {
      if (!this.config.storageUrl) {
        throw new Error("MongoDB storage URL is not configured");
      }

      if (this._isConnected() && connectionConfig === this.config.storageUrl) {
        return;
      }

      if (clientInstance) {
        try {
          await clientInstance.close();
        } catch (error) {}
      }

      const client = new MongoClient(this.config.storageUrl, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await client.connect();
      clientInstance = client;
      connectionConfig = this.config.storageUrl;
      dbInstance = client.db(this.config.storageDatabase);
    } catch (error) {
      connectionPromise = null;
      clientInstance = null;
      dbInstance = null;
      connectionConfig = null;
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  async _ensureConnection() {
    if (!this._isConnected()) {
      connectionPromise = null;
      await this.init();
    }
  }

  get db() {
    if (!dbInstance) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return dbInstance;
  }

  async close() {
    if (clientInstance && this._isConnected()) {
      try {
        await clientInstance.close();
      } catch (error) {
        console.error("Error closing MongoDB connection:", error.message);
      } finally {
        clientInstance = null;
        dbInstance = null;
        connectionPromise = null;
        connectionConfig = null;
      }
    }
  }

  async saveVersion(payload) {
    await this._ensureConnection();
    const collection = this.db.collection(this.config.storageCollection);
    await collection.insertOne(payload);
  }

  async getVersionByEnvironment(environment) {
    await this._ensureConnection();
    const collection = this.db.collection(this.config.storageCollection);
    return await collection.findOne({ environment });
  }
}

module.exports = { MongoStorage };
