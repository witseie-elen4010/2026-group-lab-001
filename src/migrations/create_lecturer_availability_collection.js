/**
 * Migration: create LecturerAvailability collection with a JSON Schema validator.
 *
 * Usage:
 *   node src/migrations/create_lecturer_availability_collection.js
 */

const { connectToDatabase, getDb, closeDatabaseConnection } = require('../models/db')

const COLLECTION_NAME = 'LecturerAvailability'

const schema = {
  bsonType: 'object',
  title: 'LecturerAvailability Object Validation',
  properties: {
    username: { bsonType: 'string' },
    user_id: { bsonType: 'objectId' },
    minStudents: { bsonType: 'int', minimum: 0 },
    maxStudents: { bsonType: 'int', minimum: 0 },
    dailyMax: { bsonType: 'int', minimum: 0 },
    duration: { bsonType: 'int', minimum: 1 },
    exceptionDates: {
      bsonType: 'array',
      items: {
        bsonType: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      }
    },
    weeklyAvailability: {
      bsonType: 'array',
      items: {
        bsonType: 'object',
        required: ['day', 'startTime', 'endTime'],
        properties: {
          day: {
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          },
          startTime: {
            bsonType: 'string',
            pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$'
          },
          endTime: {
            bsonType: 'string',
            pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$'
          },
          minStudents: { bsonType: 'int', minimum: 0 },
          maxStudents: { bsonType: 'int', minimum: 0 },
          dailyMax: { bsonType: 'int', minimum: 0 }
        }
      }
    }
  }
}

const runMigration = async function () {
  await connectToDatabase()
  const db = getDb()

  const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray()

  if (collections.length === 0) {
    await db.createCollection(COLLECTION_NAME, {
      validator: { $jsonSchema: schema },
      validationAction: 'warn'
    })
    console.log('Created collection and added validator for', COLLECTION_NAME)
    await closeDatabaseConnection()
    return 'created'
  } else {
    await db.command({
      collMod: COLLECTION_NAME,
      validator: { $jsonSchema: schema },
      validationAction: 'warn'
    })
    console.log('Updated validator for existing collection', COLLECTION_NAME)
    await closeDatabaseConnection()
    return 'updated'
  }
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}

module.exports = {
  COLLECTION_NAME,
  runMigration,
  schema
}
