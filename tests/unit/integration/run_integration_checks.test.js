const fs = require('node:fs')
const { createInstrumenter } = require('istanbul-lib-instrument')
const path = require('node:path')
const vm = require('node:vm')
// integration checks
const SCRIPT_PATH = path.resolve(__dirname, '../../src/integration/run_integration_checks.js')
const instrumenter = createInstrumenter()

const flushMicrotasks = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const executeScript = async function ({ availabilityMock, dbMock, env = {} }) {
  const code = instrumenter.instrumentSync(fs.readFileSync(SCRIPT_PATH, 'utf8'), SCRIPT_PATH)
  const coverageStore = global.__coverage__ || {}
  const consoleStub = {
    error: jest.fn(),
    log: jest.fn()
  }
  const processStub = {
    env,
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
      if (request === '../models/lecturer_availability_db') {
        return availabilityMock
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

describe('integration check script', () => {
  test('exits with success when the saved availability matches', async () => {
    const dbMock = {
      closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      connectToDatabase: jest.fn().mockResolvedValue(undefined)
    }
    const availabilityMock = {
      getLecturerAvailability: jest.fn().mockResolvedValue({ minStudents: 1 }),
      setLecturerAvailability: jest.fn().mockResolvedValue(undefined)
    }

    const { processStub } = await executeScript({
      availabilityMock,
      dbMock,
      env: {
        INTEG_TEST_USER: 'custom_lecturer'
      }
    })

    expect(availabilityMock.setLecturerAvailability).toHaveBeenCalledWith('custom_lecturer', expect.objectContaining({
      minStudents: 1
    }))
    expect(processStub.exit).toHaveBeenCalledWith(0)
    expect(dbMock.closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })

  test('exits with mismatch code when the fetched data does not match', async () => {
    const dbMock = {
      closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      connectToDatabase: jest.fn().mockResolvedValue(undefined)
    }
    const availabilityMock = {
      getLecturerAvailability: jest.fn().mockResolvedValue({ minStudents: 99 }),
      setLecturerAvailability: jest.fn().mockResolvedValue(undefined)
    }

    const { consoleStub, processStub } = await executeScript({
      availabilityMock,
      dbMock
    })

    expect(consoleStub.error).toHaveBeenCalledWith('Integration check failed: fetched data mismatch')
    expect(processStub.exit).toHaveBeenCalledWith(2)
  })

  test('exits with error code when the script throws', async () => {
    const dbMock = {
      closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
      connectToDatabase: jest.fn().mockRejectedValue('database unavailable')
    }
    const availabilityMock = {
      getLecturerAvailability: jest.fn(),
      setLecturerAvailability: jest.fn()
    }

    const { consoleStub, processStub } = await executeScript({
      availabilityMock,
      dbMock
    })

    expect(consoleStub.error).toHaveBeenCalledWith('Integration check error:', 'database unavailable')
    expect(processStub.exit).toHaveBeenCalledWith(1)
    expect(dbMock.closeDatabaseConnection).toHaveBeenCalledTimes(1)
  })
})
