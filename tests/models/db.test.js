const path = require('node:path')
// tests db functions used for all collection specific logic
const ORIGINAL_ENV = process.env

const loadDbModule = function (options = {}) {
  const databaseName = Object.prototype.hasOwnProperty.call(options, 'databaseName')
    ? options.databaseName
    : 'LetsTalk'
  const mongoUri = Object.prototype.hasOwnProperty.call(options, 'mongoUri')
    ? options.mongoUri
    : 'mongodb://localhost:27017'

  jest.resetModules()
  process.env = { ...ORIGINAL_ENV }

  if (typeof databaseName === 'undefined') {
    delete process.env.MONGODB_DB_NAME
  } else {
    process.env.MONGODB_DB_NAME = databaseName
  }

  if (typeof mongoUri === 'undefined') {
    delete process.env.MONGODB_URI
  } else {
    process.env.MONGODB_URI = mongoUri
  }

  const setServers = jest.fn()
  const config = jest.fn()
  const collection = jest.fn().mockReturnValue({ collectionName: 'User' })
  const dbInstance = {
    collection
  }
  const dbFactory = jest.fn().mockReturnValue(dbInstance)
  const connect = jest.fn().mockResolvedValue(undefined)
  const close = jest.fn().mockResolvedValue(undefined)
  const clientInstance = {
    close,
    connect,
    db: dbFactory
  }
  const MongoClient = jest.fn().mockImplementation(() => clientInstance)

  jest.doMock('node:dns', () => ({
    setServers
  }))
  jest.doMock('dotenv', () => ({
    config
  }))
  jest.doMock('mongodb', () => ({
    MongoClient,
    ServerApiVersion: {
      v1: 'v1'
    }
  }))

  return {
    close,
    collection,
    config,
    connect,
    dbFactory,
    dbInstance,
    dbModule: require('../../src/models/db'),
    MongoClient,
    setServers
  }
}

describe('db model', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV
    jest.resetModules()
  })

  test('loads dotenv and configures dns servers on startup', () => {
    const { config, dbModule, setServers } = loadDbModule({
      databaseName: 'CustomDb'
    })

    expect(config).toHaveBeenCalledWith({
      path: path.resolve(__dirname, '../../.env'),
      quiet: true
    })
    expect(setServers).toHaveBeenCalledWith(['8.8.8.8', '1.1.1.1'])
    expect(dbModule.DATABASE_NAME).toBe('CustomDb')
  })

  test('throws when the MongoDB connection string is missing', () => {
    const { dbModule } = loadDbModule({
      mongoUri: undefined
    })

    expect(() => dbModule.getMongoUri()).toThrow('MONGODB_URI environment variable is not set.')
  })

  test('connects once and caches the database instance', async () => {
    const { connect, dbFactory, dbInstance, dbModule, MongoClient } = loadDbModule()

    await expect(dbModule.connectToDatabase()).resolves.toBe(dbInstance)
    await expect(dbModule.connectToDatabase()).resolves.toBe(dbInstance)

    expect(MongoClient).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledTimes(1)
    expect(dbFactory).toHaveBeenCalledWith('LetsTalk')
  })

  test('throws when getDb is called before connecting', () => {
    const { dbModule } = loadDbModule()

    expect(() => dbModule.getDb()).toThrow('Database has not been connected yet.')
  })

  test('returns collections from the active database connection', async () => {
    const { collection, dbModule } = loadDbModule()

    await dbModule.connectToDatabase()

    expect(dbModule.getCollection('User')).toEqual({ collectionName: 'User' })
    expect(collection).toHaveBeenCalledWith('User')
  })

  test('closes and clears the cached connection state', async () => {
    const { close, dbModule } = loadDbModule()

    await expect(dbModule.closeDatabaseConnection()).resolves.toBeUndefined()

    await dbModule.connectToDatabase()
    await dbModule.closeDatabaseConnection()

    expect(close).toHaveBeenCalledTimes(1)
    expect(() => dbModule.getDb()).toThrow('Database has not been connected yet.')
  })
})
