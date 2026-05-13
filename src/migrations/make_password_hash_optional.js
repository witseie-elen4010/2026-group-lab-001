require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb')

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

const run = async function () {
  await client.connect()
  const db = client.db('LetsTalk')

  await db.command({
    collMod: 'User',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'email', 'facultyId', 'firstName', 'lastName', 'role', 'schoolId', 'universityId', 'username'],
        properties: {
          _id: { bsonType: 'objectId' },
          email: { bsonType: 'string' },
          facultyId: { bsonType: 'string' },
          firstName: { bsonType: 'string' },
          lastName: { bsonType: 'string' },
          passwordHash: { bsonType: 'string' },
          googleId: { bsonType: 'string' },
          role: { bsonType: 'string', enum: ['student', 'lecturer', 'admin'] },
          schoolId: { bsonType: 'string' },
          universityId: { bsonType: 'string' },
          username: { bsonType: 'string' }
        }
      }
    }
  })

  console.log('Migration complete: passwordHash is now optional, googleId added.')
  await client.close()
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
