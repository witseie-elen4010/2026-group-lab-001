const { connectToDatabase, closeDatabaseConnection } = require('../models/db')
const { setLecturerAvailability, getLecturerAvailability } = require('../models/lecturer_availability_db')

const DEFAULT_TEST_USER = 'integration_test_lecturer'

const run = async function () {
  try {
    await connectToDatabase()
    console.log('Connected to database')

    const testUser = process.env.INTEG_TEST_USER || DEFAULT_TEST_USER
    const prefs = {
      minStudents: 1,
      maxStudents: 3,
      duration: 30,
      dailyMax: 6,
      weeklyAvailability: [
        { day: 'monday', startTime: '09:00', endTime: '17:00' }
      ],
      exceptionDates: []
    }

    console.log(`Setting availability for ${testUser}`)
    await setLecturerAvailability(testUser, prefs)

    const fetched = await getLecturerAvailability(testUser)
    console.log('Fetched availability:', fetched)

    if (fetched && fetched.minStudents === prefs.minStudents) {
      console.log('Integration check passed')
      return 0
    }

    console.error('Integration check failed: fetched data mismatch')
    return 2
  } catch (err) {
    console.error('Integration check error:', err && err.message ? err.message : err)
    return 1
  } finally {
    try { await closeDatabaseConnection() } catch (_) {}
  }
}

if (require.main === module) {
  run().then(function (exitCode) {
    process.exit(exitCode)
  })
}

module.exports = {
  run
}
