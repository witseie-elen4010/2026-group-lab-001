const { getCollection } = require('./db')

const COLLECTION_NAME = 'Consultation'

const consultationsCollection = function () {
  return getCollection(COLLECTION_NAME)
}

/**
 * Inserts a new consultation document.
 * @param {object} consultation - Consultation document to insert.
 * @returns {Promise<import('mongodb').InsertOneResult>} MongoDB insert result.
 */
const addConsultation = async function (consultation) {
  return consultationsCollection().insertOne(consultation)
}

module.exports = {
  addConsultation
}
