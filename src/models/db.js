const path = require('node:path');
const dns = require('node:dns');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
dns.setServers(['8.8.8.8', '1.1.1.1']);

//retrieve the connection string from .env
const DATABASE_NAME = process.env.MONGODB_DB_NAME || 'LetsTalk';

let client;
let db;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set. Create a .env file in the project root or export MONGODB_URI before running this script.');
  }

  return uri;
}

async function connectToDatabase() {
  if (db) return db;

  client = new MongoClient(getMongoUri(), {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();
  db = client.db(DATABASE_NAME);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database has not been connected yet.');
  }
  return db;
}

function getCollection(name) {
  return getDb().collection(name);
}

async function closeDatabaseConnection() {
  if (!client) {
    return;
  }
  await client.close();
  client = undefined;
  db = undefined;
}

module.exports = {
  DATABASE_NAME,
  closeDatabaseConnection,
  connectToDatabase,
  getDb,
  getCollection,
  getMongoUri
};