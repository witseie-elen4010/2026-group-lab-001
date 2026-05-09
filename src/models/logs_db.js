'use strict'

const { getCollection } = require('./db')

const LOGS_COLLECTION = 'Logs'

/**
 * Inserts a log entry into the Logs collection.
 * @param {object} logEntry - Log entry to insert.
 * @param {string} logEntry.date - Date in YYYY-MM-DD format.
 * @param {string} logEntry.time - Time in HH:MM:SS format.
 * @param {string} logEntry.username - Username or 'anonymous'.
 * @param {string} logEntry.label - Action description.
 * @param {number} logEntry.httpCode - HTTP status code.
 * @returns {Promise<object>} The insert result.
 */
const addLog = async function (logEntry) {
  const collection = await getCollection(LOGS_COLLECTION)
  return collection.insertOne(logEntry)
}

/**
 * Retrieves all logs from the Logs collection, sorted by date and time descending.
 * @returns {Promise<Array<object>>} Array of log entries.
 */
const getAllLogs = async function () {
  const collection = await getCollection(LOGS_COLLECTION)
  return collection
    .find({})
    .sort({ date: -1, time: -1 })
    .toArray()
}

module.exports = {
  addLog,
  getAllLogs
}
