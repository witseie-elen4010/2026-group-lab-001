const flushMicrotasks = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const createElement = function (overrides = {}) {
  const listeners = {}

  return {
    _formData: [],
    action: '/user_profile',
    hidden: true,
    textContent: '',
    addEventListener: function (type, handler) {
      listeners[type] = handler
    },
    dispatch: function (type, event = {}) {
      return listeners[type] ? listeners[type](event) : undefined
    },
    ...overrides
  }
}

const createDocument = function ({ errorContainer, form, successContainer }) {
  let readyHandler = null

  return {
    addEventListener: function (type, handler) {
      if (type === 'DOMContentLoaded') {
        readyHandler = handler
      }
    },
    querySelector: function (selector) {
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
    },
    triggerReady: function () {
      if (readyHandler) {
        readyHandler()
      }
    }
  }
}

describe('consultation preferences browser script', () => {
  beforeEach(() => {
    jest.resetModules()
    global.fetch = jest.fn()
    global.FormData = function (form) {
      return form._formData
    }
  })

  afterAll(() => {
    delete global.document
    delete global.fetch
    delete global.FormData
  })

  test('shows a success message when the preferences save succeeds', async () => {
    const form = createElement({
      _formData: [['username', 'lecturer1']],
      action: '/user_profile?user=lecturer1'
    })
    const errorContainer = createElement({ hidden: true })
    const successContainer = createElement({ hidden: true })
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockReturnValue(undefined)

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true })
    })
    global.document = createDocument({
      errorContainer,
      form,
      successContainer
    })

    try {
      require('../../src/public/scripts/consultation_preferences')
      global.document.triggerReady()

      await form.dispatch('submit', {
        preventDefault: jest.fn()
      })
      await flushMicrotasks()

      expect(global.fetch).toHaveBeenCalledWith('/user_profile?user=lecturer1', expect.objectContaining({
        method: 'POST'
      }))
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
      expect(errorContainer.hidden).toBe(true)
      expect(successContainer.hidden).toBe(false)
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  test('shows a network error when the request fails', async () => {
    const form = createElement({
      _formData: [['username', 'lecturer1']]
    })
    const errorContainer = createElement({ hidden: true })
    const successContainer = createElement({ hidden: true })

    global.fetch.mockRejectedValue(new Error('network error'))
    global.document = createDocument({
      errorContainer,
      form,
      successContainer
    })

    require('../../src/public/scripts/consultation_preferences')
    global.document.triggerReady()

    await form.dispatch('submit', {
      preventDefault: jest.fn()
    })
    await flushMicrotasks()

    expect(errorContainer.hidden).toBe(false)
    expect(errorContainer.textContent).toBe('Network error. Please try again.')
    expect(successContainer.hidden).toBe(true)
  })

  test('shows an unexpected error when the response body is not valid JSON', async () => {
    const form = createElement({
      _formData: [['username', 'lecturer1']]
    })
    const errorContainer = createElement({ hidden: true })
    const successContainer = createElement({ hidden: true })

    global.fetch.mockResolvedValue({
      json: jest.fn().mockRejectedValue(new Error('invalid json'))
    })
    global.document = createDocument({
      errorContainer,
      form,
      successContainer
    })

    require('../../src/public/scripts/consultation_preferences')
    global.document.triggerReady()

    await form.dispatch('submit', {
      preventDefault: jest.fn()
    })
    await flushMicrotasks()

    expect(errorContainer.hidden).toBe(false)
    expect(errorContainer.textContent).toBe('An unexpected error occurred.')
    expect(successContainer.hidden).toBe(true)
  })
})
