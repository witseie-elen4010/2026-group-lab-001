const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('register', {
    title: 'Register',
    error: '',
    emailAddress: '',
    username: ''
  });
});

router.post('/', (req, res) => {
  const { emailAddress, username, password } = req.body;

  if (!emailAddress || !username || !password) {
    return res.status(400).render('register', {
      title: 'Register',
      error: 'Username, Email and Password are required.',
      emailAddress: emailAddress || '',
      username: username || ''
    });
  }
  res.redirect(`/login`);
});

module.exports = router;