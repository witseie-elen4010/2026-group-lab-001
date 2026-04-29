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

/**
 * Returns consultations for a lecturer on a specific date.
 * @param {string} lecturerId - Lecturer username.
 * @param {string} isoDate - Date in YYYY-MM-DD format.
 * @returns {Promise<Array<object>>} Matching consultation documents.
 */
const listConsultationsForLecturerOnDate = async function (lecturerId, isoDate) {
  return consultationsCollection().find({
    lecturerId,
    datetime: {
      $gte: `${isoDate}T00:00`,
      $lt: `${isoDate}T23:59~`
    }
  }).toArray()
}

module.exports = {
  addConsultation,
  listConsultationsForLecturerOnDate
}
