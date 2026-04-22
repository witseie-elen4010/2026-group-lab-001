const path = require('node:path')
const dns = require('node:dns')
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion } = require('mongodb')

const DNS_SERVERS = ['8.8.8.8', '1.1.1.1']

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true })
dns.setServers(DNS_SERVERS)

// retrieve the connection string from .env
const DATABASE_NAME = process.env.MONGODB_DB_NAME || 'LetsTalk'

let client
let db

/**
 * Returns the configured MongoDB connection string.
 * @returns {string} The MongoDB connection URI.
 */
const getMongoUri = function () {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set. Create a .env file in the project root or export MONGODB_URI before running this script.')
  }

  return uri
}

/**
 * Connects to MongoDB and returns the current database instance.
 * @returns {Promise<import('mongodb').Db>} The connected database instance.
 */
const connectToDatabase = async function () {
  if (db) return db

  client = new MongoClient(getMongoUri(), {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  })

  await client.connect()
  db = client.db(DATABASE_NAME)
  return db
}

/**
 * Returns the active database connection.
 * @returns {import('mongodb').Db} The active database instance.
 */
const getDb = function () {
  if (!db) {
    throw new Error('Database has not been connected yet.')
  }

  return db
}

/**
 * Returns a collection from the active database connection.
 * @param {string} name - MongoDB collection name.
 * @returns {import('mongodb').Collection} The requested collection.
 */
const getCollection = function (name) {
  return getDb().collection(name)
}

/**
 * Closes the active database connection when one exists.
 * @returns {Promise<void>} Resolves when the connection is closed.
 */
const closeDatabaseConnection = async function () {
  if (!client) {
    return
  }

  await client.close()
  client = undefined
  db = undefined
}

module.exports = {
  DATABASE_NAME,
  closeDatabaseConnection,
  connectToDatabase,
  getDb,
  getCollection,
  getMongoUri
}
