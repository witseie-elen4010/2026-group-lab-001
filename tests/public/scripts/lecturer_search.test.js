const flushMicrotasks = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const createEventTarget = function (overrides = {}) {
  const listeners = {}

  return {
    innerHTML: '',
    addEventListener: function (type, handler) {
      listeners[type] = handler
    },
    dispatch: function (type, event = {}) {
      return listeners[type] ? listeners[type](event) : undefined
    },
    ...overrides
  }
}

const createForm = function ({ facultyId = '', q = '', schoolId = '' } = {}) {
  const form = createEventTarget()

  form.elements = {
    facultyId: { value: facultyId },
    q: { value: q },
    schoolId: { value: schoolId }
  }

  return form
}

const createDocument = function ({ form, resultsSection }) {
  let readyHandler = null

  return {
    addEventListener: function (type, handler) {
      if (type === 'DOMContentLoaded') {
        readyHandler = handler
      }
    },
    getElementById: function (id) {
      if (id === 'lecturer_search_form') {
        return form || null
      }
      if (id === 'lecturer_results') {
        return resultsSection || null
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

const createWindow = function (search = '') {
  const listeners = {}

  return {
    addEventListener: function (type, handler) {
      listeners[type] = handler
    },
    history: {
      pushState: jest.fn()
    },
    location: {
      search
    },
    trigger: function (type) {
      return listeners[type] ? listeners[type]() : undefined
    }
  }
}

describe('lecturer search browser script', () => {
  beforeEach(() => {
    jest.resetModules()
    global.fetch = jest.fn()
    global.FormData = function (form) {
      return [
        ['q', form.elements.q.value],
        ['facultyId', form.elements.facultyId.value],
        ['schoolId', form.elements.schoolId.value]
      ]
    }
  })

  afterAll(() => {
    delete global.document
    delete global.fetch
    delete global.FormData
    delete global.window
  })

  test('submits the form, pushes history, and renders escaped lecturer results', async () => {
    const form = createForm({ facultyId: 'Engineering', q: 'alice', schoolId: 'EIE' })
    const resultsSection = createEventTarget({ innerHTML: '<p>old</p>' })

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        lecturers: [{
          facultyId: 'Engineering',
          firstName: '<Alice>',
          lastName: '& Smith',
          schoolId: 'EIE',
          username: 'alice'
        }],
        page: 1,
        totalPages: 1
      }),
      ok: true
    })
    global.window = createWindow('')
    global.document = createDocument({ form, resultsSection })

    require('../../../src/public/scripts/lecturer_search')
    global.document.triggerReady()

    await form.dispatch('submit', {
      preventDefault: jest.fn()
    })
    await flushMicrotasks()

    expect(global.window.history.pushState).toHaveBeenCalledWith(null, '', '/home?q=alice&facultyId=Engineering&schoolId=EIE')
    expect(global.fetch).toHaveBeenCalledWith('/home?q=alice&facultyId=Engineering&schoolId=EIE', {
      headers: { Accept: 'application/json' }
    })
    expect(resultsSection.innerHTML).toContain('/user_profile?user=alice')
    expect(resultsSection.innerHTML).toContain('&lt;Alice&gt; &amp; Smith')
  })

  test('follows pagination clicks by requesting the selected page', async () => {
    const form = createForm({ facultyId: 'Engineering', q: 'alice', schoolId: 'EIE' })
    const resultsSection = createEventTarget()

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        lecturers: [],
        page: 2,
        totalPages: 2
      }),
      ok: true
    })
    global.window = createWindow('')
    global.document = createDocument({ form, resultsSection })

    require('../../../src/public/scripts/lecturer_search')
    global.document.triggerReady()

    await resultsSection.dispatch('click', {
      preventDefault: jest.fn(),
      target: {
        closest: function () {
          return {
            dataset: {
              page: '2'
            }
          }
        }
      }
    })
    await flushMicrotasks()

    expect(global.window.history.pushState).toHaveBeenCalledWith(null, '', '/home?q=alice&facultyId=Engineering&schoolId=EIE&page=2')
    expect(global.fetch).toHaveBeenCalledWith('/home?q=alice&facultyId=Engineering&schoolId=EIE&page=2', {
      headers: { Accept: 'application/json' }
    })
  })

  test('syncs the form from the URL on popstate and fetches that result set', async () => {
    const form = createForm()
    const resultsSection = createEventTarget()

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        lecturers: [],
        page: 3,
        totalPages: 3
      }),
      ok: true
    })
    global.window = createWindow('?q=bob&facultyId=Science&schoolId=Physics&page=3')
    global.document = createDocument({ form, resultsSection })

    require('../../../src/public/scripts/lecturer_search')
    global.document.triggerReady()

    await global.window.trigger('popstate')
    await flushMicrotasks()

    expect(form.elements.q.value).toBe('bob')
    expect(form.elements.facultyId.value).toBe('Science')
    expect(form.elements.schoolId.value).toBe('Physics')
    expect(global.fetch).toHaveBeenCalledWith('/home?q=bob&facultyId=Science&schoolId=Physics&page=3', {
      headers: { Accept: 'application/json' }
    })
  })
})
