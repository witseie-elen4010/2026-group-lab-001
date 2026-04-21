const {
  closeDatabaseConnection,
  connectToDatabase,
  DATABASE_NAME,
  getDb
} = require('../../src/models/db');
const { addUser, deleteUser, getUser } = require('../../src/models/user_db');

// fetching the connection string for the LetsTalk database (MongoDB Atlas)
const runDbTest = process.env.MONGODB_URI ? test : test.skip;
const COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'User';

//placeholder fields the table is initialised with
const EXPECTED_USER = {
  _id: '69e7a1803578de0763686bbd',
  email: 'test@email.com',
  firstName: 'name',
  lastName: 'surname',
  role: 'student',
  universityId: 'uni_id',
  facultyId: 'faculty_id',
  schoolId: 'school_id',
  username: 'user',
  passwordHash: 'hashed_password_here'
};

//all strings except for ID (objectID). University, faculty and school IDs
// will be changed to objectID in Role Distinction story
const EXPECTED_FIELDS = [
  '_id', //unique (checked for by db, not in-code)
  'email',
  'firstName',
  'lastName',
  'role',
  'universityId',
  'facultyId',
  'schoolId', //db limits this to either lecturer or student (via enum)
  'username', //unique (check for by db, not in-code)
  'passwordHash'
];

function createTestUser(overrides = {}) {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `newUser_${uniqueSuffix}@email.com`,
    firstName: 'newUser',
    lastName: 'newUser',
    role: 'student',
    universityId: `uni_${uniqueSuffix}`,
    facultyId: `faculty_${uniqueSuffix}`,
    schoolId: `school_${uniqueSuffix}`,
    username: `WeLoveNoSQL_${uniqueSuffix}`,
    passwordHash: `password_${uniqueSuffix}`,
    ...overrides
  };
}

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    return;
  }
  await connectToDatabase();
});
afterAll(async () => {
  await closeDatabaseConnection();
});

describe('MongoDB Atlas setup', () => {
  runDbTest('Connects to Atlas and finds "User" collection', async () => {
    const collections = await getDb()
      .listCollections({}, { nameOnly: true })
      .toArray();

    const collectionNames = collections.map((collection) => collection.name);
    expect(DATABASE_NAME).toBe('LetsTalk');
    expect(collectionNames).toContain(COLLECTION_NAME);
  });
});

describe('MongoDB Atlas test user', () => {
  runDbTest('Returns the expected test user by username', async () => {
    const user = await getUser(EXPECTED_USER.username);

    expect(user).not.toBeNull();
    expect(user).toMatchObject({
      email: EXPECTED_USER.email,
      firstName: EXPECTED_USER.firstName,
      lastName: EXPECTED_USER.lastName,
      role: EXPECTED_USER.role,
      universityId: EXPECTED_USER.universityId,
      facultyId: EXPECTED_USER.facultyId,
      schoolId: EXPECTED_USER.schoolId,
      username: EXPECTED_USER.username,
      passwordHash: EXPECTED_USER.passwordHash
    });
    expect(user._id.toString()).toBe(EXPECTED_USER._id);
  });
  //document = entry in table 
  runDbTest('Includes all expected fields on the test user document', async () => {
    const user = await getUser(EXPECTED_USER.username);
    expect(user).not.toBeNull();
    for (const field of EXPECTED_FIELDS) {
      expect(user).toHaveProperty(field);
    }
  });

  runDbTest('Adds a new user document to the "User" collection', async () => {
    const newUser = createTestUser();

    try {
      const insertResult = await addUser(newUser);
      expect(insertResult.acknowledged).toBe(true);
      expect(insertResult.insertedId).toBeDefined();
      const insertedUser = await getUser(newUser.username);
      expect(insertedUser).not.toBeNull();
      expect(insertedUser).toMatchObject(newUser);
      expect(insertedUser._id.toString()).toBe(insertResult.insertedId.toString());
    } finally {
      //to avoid flooding our database with test cases
      await deleteUser(newUser.username);
    }
  });

  // If this test fails, go delete test user manually on Atlas
  runDbTest('deletes a user document from the "User" collection', async () => {
    const newUser = createTestUser();

    try {
      await addUser(newUser);
      const deleteResult = await deleteUser(newUser.username);
      expect(deleteResult.acknowledged).toBe(true);
      expect(deleteResult.deletedCount).toBe(1);
      const deletedUser = await getUser(newUser.username);
      expect(deletedUser).toBeNull();
    } finally {
      await deleteUser(newUser.username);
    }
  });

  runDbTest('Rejects a user when role is not lecturer or student', async () => {
    const invalidUser = createTestUser({ role: 'admin' });

    await expect(addUser(invalidUser)).rejects.toMatchObject({
      name: expect.stringMatching(/Mongo/),
      message: expect.stringMatching(/validation|document failed/i)
    });

    await deleteUser(invalidUser.username);
  });

  runDbTest('Rejects creating two users with the same username', async () => {
    const originalUser = createTestUser();
    const duplicateUser = createTestUser({
      username: originalUser.username,
      email: `duplicate@email.com`
    });
    try {
      await addUser(originalUser);
      await expect(addUser(duplicateUser)).rejects.toMatchObject({
        code: 11000
      });
    } finally {
      await deleteUser(originalUser.username);
      await deleteUser(duplicateUser.username);
    }
  });
});