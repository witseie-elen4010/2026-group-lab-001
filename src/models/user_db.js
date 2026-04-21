const { getCollection } = require('./db');

function usersCollection() {
  return getCollection('User');
}

async function getUser(username) {
  return usersCollection().findOne({ username });
}

async function addUser(user) {
  return usersCollection().insertOne(user);
}

async function deleteUser(username) {
  return usersCollection().deleteOne({ username });
}

module.exports = {
  addUser,
  deleteUser,
  getUser
};