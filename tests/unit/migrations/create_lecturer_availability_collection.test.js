const fs = require('node:fs')
const { createInstrumenter } = require('istanbul-lib-instrument')
const path = require('node:path')
const vm = require('node:vm')
// lecturer availability collection tests
const SCRIPT_PATH = path.resolve(__dirname, '../../src/migrations/create_lecturer_availability_collection.js')
const instrumenter = createInstrumenter()

const flushMicrotasks = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const executeScript = async function ({ dbMock }) {
  const code = instrumenter.instrumentSync(fs.readFileSync(SCRIPT_PATH, 'utf8'), SCRIPT_PATH)
  const coverageStore = global.__coverage__ || {}
  const consoleStub = {
    error: jest.fn(),
    log: jest.fn()
  }
  const processStub = {
    exit: jest.fn()
  }

  vm.runInNewContext(code, {
    Buffer,
    Promise,
    __coverage__: coverageStore,
    __dirname: path.dirname(SCRIPT_PATH),
    __filename: SCRIPT_PATH,
    console: consoleStub,
    exports: {},
    module: { exports: {} },
    process: processStub,
    require: function (request) {
      if (request === '../models/db') {
        return dbMock
      }

      return require(request)
    },
    setImmediate,
    setTimeout
  }, { filename: SCRIPT_PATH })

  global.__coverage__ = coverageStore

  await flushMicrotasks()
  await flushMicrotasks()

  return {
    consoleStub,
    processStub
  }
}

describe('lecturer availability migration script', () => {
  test('creates the collection when it does not exist', async () => {
    const listCollections = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([])
    })
    const createCollection = jest.fn().mockResolvedValue(undefined)
    const dbMock = {
      closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      connectToDatabase: jest.fn().mockResolvedValue(undefined),
      getDb: jest.fn().mockReturnValue({
        createCollection,
        listCollections
      })
    }

    const { consoleStub, processStub } = await executeScript({ dbMock })

    expect(createCollection).toHaveBeenCalledWith('LecturerAvailability', expect.objectContaining({
      validationAction: 'warn',
      validator: expect.any(Object)
    }))
    expect(consoleStub.log).toHaveBeenCalledWith('Created collection and added validator for', 'LecturerAvailability')
    expect(processStub.exit).not.toHaveBeenCalled()
    expect(dbMock.closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('updates the validator when the collection already exists', async () => {
    const command = jest.fn().mockResolvedValue(undefined)
    const listCollections = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ name: 'LecturerAvailability' }])
    })
    const dbMock = {
      closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      connectToDatabase: jest.fn().mockResolvedValue(undefined),
      getDb: jest.fn().mockReturnValue({
        command,
        listCollections
      })
    }

    const { consoleStub } = await executeScript({ dbMock })

    expect(command).toHaveBeenCalledWith(expect.objectContaining({
      collMod: 'LecturerAvailability',
      validationAction: 'warn',
      validator: expect.any(Object)
    }))
    expect(consoleStub.log).toHaveBeenCalledWith('Updated validator for existing collection', 'LecturerAvailability')
  })

  test('logs and exits when the migration fails', async () => {
    const failure = new Error('cannot connect')
    const dbMock = {
      closeDatabaseConnection: jest.fn(),
      connectToDatabase: jest.fn().mockRejectedValue(failure),
      getDb: jest.fn()
    }

    const { consoleStub, processStub } = await executeScript({ dbMock })

    expect(consoleStub.error).toHaveBeenCalledWith('Migration failed:', failure)
    expect(processStub.exit).toHaveBeenCalledWith(1)
  })
})
