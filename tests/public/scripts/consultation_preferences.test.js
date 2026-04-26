const loadScript = function ({ errorContainer, form, successContainer } = {}) {
  jest.resetModules()

  const domReadyListeners = {}
  global.document = {
    addEventListener: jest.fn(function (eventName, handler) {
      domReadyListeners[eventName] = handler
    }),
    querySelector: jest.fn(function (selector) {
      if (selector === '.consultation_preferences_form') {
        return form || null
      }
      if (selector === '.consult_pref_error_container') {
        return errorContainer || null
      }
      if (selector === '.consult_pref_success_container') {
        return successContainer || null
      }
      return null
    })
  }

  require('../../../src/public/scripts/consultation_preferences')

  return domReadyListeners.DOMContentLoaded
}

describe('consultation preferences script', () => {
  afterEach(() => {
    delete global.FormData
    delete global.document
    delete global.fetch
    jest.useRealTimers()
  })

  test('returns early when the consultation preferences form is missing', () => {
    const domReady = loadScript()

    expect(() => domReady()).not.toThrow()
  })

  test('submits preferences and shows a temporary success message', async () => {
    jest.useFakeTimers()

    const form = {
      action: '/user_profile',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const errorContainer = { hidden: true, textContent: '' }
    const successContainer = { hidden: true }

    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true })
    })
    global.FormData = jest.fn().mockImplementation(function () {
      return [['minStudents', '1']]
    })

    const domReady = loadScript({ errorContainer, form, successContainer })
    domReady()

    await form.listeners.submit({
      preventDefault: jest.fn()
    })

    expect(global.fetch).toHaveBeenCalledWith('/user_profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: expect.any(URLSearchParams)
    })
    expect(errorContainer.hidden).toBe(true)
    expect(successContainer.hidden).toBe(false)

    jest.advanceTimersByTime(3000)

    expect(successContainer.hidden).toBe(true)
  })

  test('shows a network error when the request fails before a response is returned', async () => {
    const form = {
      action: '/user_profile',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const errorContainer = { hidden: true, textContent: '' }
    const successContainer = { hidden: false }

    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))
    global.FormData = jest.fn().mockImplementation(function () {
      return [['minStudents', '1']]
    })

    const domReady = loadScript({ errorContainer, form, successContainer })
    domReady()

    await form.listeners.submit({
      preventDefault: jest.fn()
    })

    expect(errorContainer.hidden).toBe(false)
    expect(errorContainer.textContent).toBe('Network error. Please try again.')
    expect(successContainer.hidden).toBe(true)
  })

  test('shows server-side and malformed-response errors', async () => {
    const form = {
      action: '/user_profile',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const errorContainer = { hidden: true, textContent: '' }
    const successContainer = { hidden: true }

    global.FormData = jest.fn().mockImplementation(function () {
      return [['minStudents', '1']]
    })
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ success: false, error: 'Bad preferences' })
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockRejectedValue(new Error('bad json'))
      })

    const domReady = loadScript({ errorContainer, form, successContainer })
    domReady()

    await form.listeners.submit({
      preventDefault: jest.fn()
    })
    expect(errorContainer.textContent).toBe('Bad preferences')

    await form.listeners.submit({
      preventDefault: jest.fn()
    })
    expect(errorContainer.textContent).toBe('An unexpected error occurred.')
  })
})
