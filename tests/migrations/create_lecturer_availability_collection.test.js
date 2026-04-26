jest.mock('../../src/models/db', () => ({
  closeDatabaseConnection: jest.fn(),
  connectToDatabase: jest.fn(),
  getDb: jest.fn()
}))

const { closeDatabaseConnection, connectToDatabase, getDb } = require('../../src/models/db')
const {
  COLLECTION_NAME,
  runMigration,
  schema
} = require('../../src/migrations/create_lecturer_availability_collection')

describe('lecturer availability migration', () => {
  let consoleErrorSpy
  let consoleLogSpy
  let db
  let listCollectionsCursor

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    listCollectionsCursor = {
      toArray: jest.fn()
    }
    db = {
      command: jest.fn(),
      createCollection: jest.fn(),
      listCollections: jest.fn().mockReturnValue(listCollectionsCursor)
    }

    connectToDatabase.mockResolvedValue(undefined)
    closeDatabaseConnection.mockResolvedValue(undefined)
    getDb.mockReturnValue(db)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  test('creates the collection when it does not exist', async () => {
    listCollectionsCursor.toArray.mockResolvedValue([])

    await expect(runMigration()).resolves.toBe('created')

    expect(db.listCollections).toHaveBeenCalledWith({ name: COLLECTION_NAME })
    expect(db.createCollection).toHaveBeenCalledWith(COLLECTION_NAME, {
      validator: { $jsonSchema: schema },
      validationAction: 'warn'
    })
    expect(consoleLogSpy).toHaveBeenCalledWith('Created collection and added validator for', COLLECTION_NAME)
    expect(closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('updates the validator when the collection already exists', async () => {
    listCollectionsCursor.toArray.mockResolvedValue([{ name: COLLECTION_NAME }])

    await expect(runMigration()).resolves.toBe('updated')

    expect(db.command).toHaveBeenCalledWith({
      collMod: COLLECTION_NAME,
      validator: { $jsonSchema: schema },
      validationAction: 'warn'
    })
    expect(consoleLogSpy).toHaveBeenCalledWith('Updated validator for existing collection', COLLECTION_NAME)
    expect(closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('propagates migration failures', async () => {
    const failure = new Error('cannot connect')
    connectToDatabase.mockRejectedValue(failure)

    await expect(runMigration()).rejects.toThrow('cannot connect')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(closeDatabaseConnection).not.toHaveBeenCalled()
  })
})
