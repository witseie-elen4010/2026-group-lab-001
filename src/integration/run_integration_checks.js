const { connectToDatabase, closeDatabaseConnection } = require('../models/db')
const { setLecturerAvailability, getLecturerAvailability } = require('../models/lecturer_availability_db')

const run = async function () {
  try {
    await connectToDatabase()
    console.log('Connected to database')

    const testUser = process.env.INTEG_TEST_USER || 'integration_test_lecturer'
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
      process.exit(0)
    }

    console.error('Integration check failed: fetched data mismatch')
    process.exit(2)
  } catch (err) {
    console.error('Integration check error:', err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    try { await closeDatabaseConnection() } catch (_) {}
  }
}

run()
