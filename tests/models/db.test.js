const ORIGINAL_ENV = process.env

const loadDbModule = function ({ dbName = 'LetsTalk', mongoUri } = {}) {
  jest.resetModules()

  const close = jest.fn().mockResolvedValue(undefined)
  const dbInstance = {
    collection: jest.fn(function (name) {
      return { name }
    })
  }
  const clientInstance = {
    close,
    connect: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue(dbInstance)
  }
  const MongoClient = jest.fn().mockImplementation(function () {
    return clientInstance
  })
  const dotenvConfig = jest.fn()
  const setServers = jest.fn()

  process.env = {
    ...ORIGINAL_ENV,
    MONGODB_DB_NAME: dbName
  }

  if (typeof mongoUri === 'string') {
    process.env.MONGODB_URI = mongoUri
  } else {
    delete process.env.MONGODB_URI
  }

  jest.doMock('dotenv', () => ({
    config: dotenvConfig
  }))
  jest.doMock('node:dns', () => ({
    setServers
  }))
  jest.doMock('mongodb', () => ({
    MongoClient,
    ServerApiVersion: {
      v1: 'v1'
    }
  }))

  return {
    clientInstance,
    dbInstance,
    dotenvConfig,
    module: require('../../src/models/db'),
    MongoClient,
    setServers
  }
}

describe('database helpers', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV
    jest.resetModules()
    jest.dontMock('dotenv')
    jest.dontMock('node:dns')
    jest.dontMock('mongodb')
  })

  test('configures dotenv and DNS servers when the module loads', () => {
    const { dotenvConfig, setServers } = loadDbModule({ mongoUri: 'mongodb://example.test' })

    expect(dotenvConfig).toHaveBeenCalledTimes(1)
    expect(setServers).toHaveBeenCalledWith(['8.8.8.8', '1.1.1.1'])
  })

  test('getMongoUri throws when the connection string is missing', () => {
    const { module } = loadDbModule()

    expect(() => module.getMongoUri()).toThrow(
      'MONGODB_URI environment variable is not set. Create a .env file in the project root or export MONGODB_URI before running this script.'
    )
  })

  test('connectToDatabase creates and caches a MongoDB client', async () => {
    const { clientInstance, dbInstance, module, MongoClient } = loadDbModule({
      dbName: 'CustomDb',
      mongoUri: 'mongodb://example.test'
    })

    await expect(module.connectToDatabase()).resolves.toBe(dbInstance)
    await expect(module.connectToDatabase()).resolves.toBe(dbInstance)

    expect(MongoClient).toHaveBeenCalledTimes(1)
    expect(MongoClient).toHaveBeenCalledWith('mongodb://example.test', {
      serverApi: {
        version: 'v1',
        strict: true,
        deprecationErrors: true
      }
    })
    expect(clientInstance.connect).toHaveBeenCalledTimes(1)
    expect(clientInstance.db).toHaveBeenCalledWith('CustomDb')
    expect(module.getDb()).toBe(dbInstance)
    expect(module.getCollection('User')).toEqual({ name: 'User' })
    expect(dbInstance.collection).toHaveBeenCalledWith('User')
  })

  test('getDb throws before a database connection exists', () => {
    const { module } = loadDbModule({ mongoUri: 'mongodb://example.test' })

    expect(() => module.getDb()).toThrow('Database has not been connected yet.')
  })

  test('closeDatabaseConnection returns without closing when no client exists', async () => {
    const { clientInstance, module } = loadDbModule({ mongoUri: 'mongodb://example.test' })

    await expect(module.closeDatabaseConnection()).resolves.toBeUndefined()
    expect(clientInstance.close).not.toHaveBeenCalled()
  })

  test('closeDatabaseConnection closes the active client and clears cached state', async () => {
    const { clientInstance, module } = loadDbModule({ mongoUri: 'mongodb://example.test' })

    await module.connectToDatabase()
    await expect(module.closeDatabaseConnection()).resolves.toBeUndefined()

    expect(clientInstance.close).toHaveBeenCalledTimes(1)
    expect(() => module.getDb()).toThrow('Database has not been connected yet.')
  })
})
