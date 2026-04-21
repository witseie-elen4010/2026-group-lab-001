const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('login', {
    title: 'Log In',
    error: '',
    username: ''
  });
});

router.post('/', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).render('login', {
      title: 'Log In',
      error: 'Username and password are required.',
      username: username || ''
    });
  }

  res.redirect(`/home`);
});

module.exports = router;