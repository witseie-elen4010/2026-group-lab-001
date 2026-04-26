const flushPromises = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const loadScript = function ({ document, windowObject }) {
  jest.resetModules()
  global.document = document
  global.window = windowObject

  require('../../../src/public/scripts/lecturer_search')
}

const createFormData = function (form) {
  return [
    ['q', form.elements.q.value],
    ['facultyId', form.elements.facultyId.value],
    ['schoolId', form.elements.schoolId.value]
  ]
}

describe('lecturer search script', () => {
  afterEach(() => {
    delete global.FormData
    delete global.document
    delete global.fetch
    delete global.window
  })

  test('returns early when the lecturer search form is missing', () => {
    const domReadyListeners = {}

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        getElementById: jest.fn().mockReturnValue(null)
      },
      windowObject: {
        addEventListener: jest.fn(),
        history: { pushState: jest.fn() },
        location: { search: '' }
      }
    })

    expect(() => domReadyListeners.DOMContentLoaded()).not.toThrow()
  })

  test('submits the lecturer search form and renders escaped results with pagination', async () => {
    const domReadyListeners = {}
    const form = {
      elements: {
        facultyId: { value: 'Engineering' },
        q: { value: 'alice' },
        schoolId: { value: 'EIE' }
      },
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const resultsSection = {
      innerHTML: '<p>Existing results</p>',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const windowListeners = {}

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        lecturers: [
          {
            username: 'alice',
            firstName: '<Alice>',
            lastName: 'Smith & Co',
            facultyId: 'Engineering',
            schoolId: 'EIE'
          }
        ],
        page: 1,
        totalPages: 2
      })
    })
    global.FormData = jest.fn().mockImplementation(createFormData)

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'lecturer_search_form') {
            return form
          }
          if (id === 'lecturer_results') {
            return resultsSection
          }
          return null
        })
      },
      windowObject: {
        addEventListener: jest.fn(function (eventName, handler) {
          windowListeners[eventName] = handler
        }),
        history: { pushState: jest.fn() },
        location: { search: '' }
      }
    })

    domReadyListeners.DOMContentLoaded()
    await form.listeners.submit({ preventDefault: jest.fn() })
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/home?q=alice&facultyId=Engineering&schoolId=EIE', {
      headers: { Accept: 'application/json' }
    })
    expect(resultsSection.innerHTML).toContain('&lt;Alice&gt;')
    expect(resultsSection.innerHTML).toContain('Smith &amp; Co')
    expect(resultsSection.innerHTML).toContain('pagination_link_active')
  })

  test('supports pagination clicks and browser navigation', async () => {
    const domReadyListeners = {}
    const form = {
      elements: {
        facultyId: { value: 'Engineering' },
        q: { value: 'alice' },
        schoolId: { value: 'EIE' }
      },
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const resultsSection = {
      innerHTML: '<p>Existing results</p>',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const pushState = jest.fn()
    const windowListeners = {}

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          lecturers: [{ username: 'alice', firstName: 'Alice', lastName: 'Smith', facultyId: 'Engineering', schoolId: 'EIE' }],
          page: 2,
          totalPages: 2
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          lecturers: [],
          page: 1,
          totalPages: 0
        })
      })
    global.FormData = jest.fn().mockImplementation(createFormData)

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'lecturer_search_form') {
            return form
          }
          if (id === 'lecturer_results') {
            return resultsSection
          }
          return null
        })
      },
      windowObject: {
        addEventListener: jest.fn(function (eventName, handler) {
          windowListeners[eventName] = handler
        }),
        history: { pushState },
        location: { search: '?q=bob&facultyId=Science&schoolId=Physics' }
      }
    })

    domReadyListeners.DOMContentLoaded()
    await resultsSection.listeners.click({
      preventDefault: jest.fn(),
      target: {
        closest: jest.fn().mockReturnValue({
          dataset: { page: '2' }
        })
      }
    })
    await flushPromises()

    expect(pushState).toHaveBeenCalledWith(null, '', '/home?q=alice&facultyId=Engineering&schoolId=EIE&page=2')

    await windowListeners.popstate()
    await flushPromises()

    expect(form.elements.q.value).toBe('bob')
    expect(form.elements.facultyId.value).toBe('Science')
    expect(form.elements.schoolId.value).toBe('Physics')
    expect(resultsSection.innerHTML).toContain('No lecturers found.')
  })

  test('retains existing results when the fetch fails', async () => {
    const domReadyListeners = {}
    const form = {
      elements: {
        facultyId: { value: 'Engineering' },
        q: { value: 'alice' },
        schoolId: { value: 'EIE' }
      },
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const resultsSection = {
      innerHTML: '<p>Existing results</p>',
      listeners: {},
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }

    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))
    global.FormData = jest.fn().mockImplementation(createFormData)

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'lecturer_search_form') {
            return form
          }
          if (id === 'lecturer_results') {
            return resultsSection
          }
          return null
        })
      },
      windowObject: {
        addEventListener: jest.fn(),
        history: { pushState: jest.fn() },
        location: { search: '' }
      }
    })

    domReadyListeners.DOMContentLoaded()
    await form.listeners.submit({ preventDefault: jest.fn() })
    await flushPromises()

    expect(resultsSection.innerHTML).toBe('<p>Existing results</p>')
  })
})
