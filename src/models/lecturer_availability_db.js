const { getCollection } = require('./db')

const COLLECTION = 'LecturerAvailability'

const getLecturerAvailability = async function (username) {
  const collection = await getCollection(COLLECTION)
  return collection.findOne({ username })
}

const setLecturerAvailability = async function (username, { minStudents, maxStudents, duration, dailyMax }) {
  const collection = await getCollection(COLLECTION)
  await collection.updateOne(
    { username },
    { $set: { username, minStudents, maxStudents, duration, dailyMax } },
    { upsert: true }
  )
}

module.exports = { getLecturerAvailability, setLecturerAvailability }
