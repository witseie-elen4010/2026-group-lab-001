const express = require('express');
const { connectToDatabase } = require('../models/db');
const { addUser } = require('../models/user_db');
const { hashPassword } = require('../utils/password');
const router = express.Router();

const PLACEHOLDER_USER_FIELDS = Object.freeze({
  facultyId: 'unassigned',
  firstName: 'Pending',
  lastName: 'Pending',
  role: 'student',
  schoolId: 'unassigned',
  universityId: 'unassigned'
});

function renderRegister(res, { statusCode = 200, error = '', emailAddress = '', username = '' } = {}) {
  return res.status(statusCode).render('register', {
    title: 'Register',
    error,
    emailAddress,
    username
  });
}

async function buildUser({ emailAddress, password, username }) {
  return {
    ...PLACEHOLDER_USER_FIELDS,
    email: emailAddress.toLowerCase(),
    passwordHash: await hashPassword(password),
    username
  };
}

router.get('/', (req, res) => {
  return renderRegister(res);
});

router.post('/', async (req, res) => {
  const emailAddress = req.body.emailAddress?.trim() || '';
  const username = req.body.username?.trim() || '';
  const password = req.body.password || '';

  if (!emailAddress || !username || !password) {
    return renderRegister(res, {
      statusCode: 400,
      error: 'Username, Email and Password are required.',
      emailAddress,
      username
    });
  }

  try {
    await connectToDatabase();
    await addUser(await buildUser({ emailAddress, password, username }));
    return res.redirect('/login');
  } catch (error) {
    if (error?.code === 11000) {
      return renderRegister(res, {
        statusCode: 409,
        error: 'Username already taken.',
        emailAddress,
        username
      });
    }

    return renderRegister(res, {
      statusCode: 500,
      error: 'Sorry. We could not create your account. Try again later.',
      emailAddress,
      username
    });
  }
});

module.exports = router;