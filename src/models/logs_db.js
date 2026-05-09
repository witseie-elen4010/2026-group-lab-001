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

/**
 * Retrieves a page of logs sorted by date and time descending.
 * @param {number} [page=1] - One-based page index.
 * @param {number} [limit=50] - Maximum logs to return per page.
 * @returns {Promise<{logs: Array<object>, hasNextPage: boolean}>} Log page data.
 */
const getLogsPage = async function (page = 1, limit = 50) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 50
  const skip = (safePage - 1) * safeLimit
  const collection = await getCollection(LOGS_COLLECTION)

  const results = await collection
    .find({})
    .sort({ date: -1, time: -1 })
    .skip(skip)
    .limit(safeLimit + 1)
    .toArray()

  return {
    logs: results.slice(0, safeLimit),
    hasNextPage: results.length > safeLimit
  }
}

module.exports = {
  addLog,
  getAllLogs,
  getLogsPage
}
