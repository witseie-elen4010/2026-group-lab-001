const flushMicrotasks = function () {
  return new Promise((resolve) => setImmediate(resolve))
}
// scripting logic executed on frontend
const createInput = function ({ describedBy, listId, name, searchLabel = '', searchParents = '', searchUrl, value = '' }) {
  const listeners = {}

  return {
    dataset: {
      searchLabel,
      searchParents,
      searchUrl
    },
    name,
    validationMessage: '',
    value,
    addEventListener: function (type, handler) {
      listeners[type] = handler
    },
    dispatch: function (type, event = {}) {
      const payload = {
        target: this,
        ...event
      }

      return listeners[type] ? listeners[type](payload) : undefined
    },
    getAttribute: function (attributeName) {
      if (attributeName === 'aria-describedby') {
        return describedBy || ''
      }
      if (attributeName === 'list') {
        return listId || ''
      }

      return null
    },
    setCustomValidity: function (message) {
      this.validationMessage = message
    }
  }
}

const createOptionsElement = function () {
  const element = {
    children: [],
    appendChild: function (child) {
      this.children.push(child)
    },
    removeChild: function (child) {
      this.children = this.children.filter(function (entry) {
        return entry !== child
      })
    }
  }

  Object.defineProperty(element, 'firstChild', {
    get: function () {
      return this.children[0] || null
    }
  })

  return element
}

const createDocument = function ({ ids, namedInputs, searchInputs }) {
  let readyHandler = null

  return {
    addEventListener: function (type, handler) {
      if (type === 'DOMContentLoaded') {
        readyHandler = handler
      }
    },
    createElement: function () {
      return { value: '' }
    },
    getElementById: function (id) {
      return ids[id] || null
    },
    querySelector: function (selector) {
      const match = selector.match(/^\[name="(.+)"\]$/)

      if (!match) {
        return null
      }

      return namedInputs[match[1]] || null
    },
    querySelectorAll: function (selector) {
      if (selector === '[data-search-url]') {
        return searchInputs
      }

      return []
    },
    triggerReady: function () {
      if (readyHandler) {
        readyHandler()
      }
    }
  }
}

describe('institution search browser script', () => {
  beforeEach(() => {
    jest.resetModules()
    global.fetch = jest.fn()
  })

  afterAll(() => {
    delete global.document
    delete global.fetch
  })

  test('fetches results and validates selected values against those results', async () => {
    const status = { textContent: '' }
    const options = createOptionsElement()
    const input = createInput({
      describedBy: 'university_status',
      listId: 'university_options',
      name: 'university',
      searchLabel: 'university',
      searchUrl: '/institutions/universities'
    })

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        results: ['University of the Witwatersrand']
      }),
      ok: true
    })
    global.document = createDocument({
      ids: {
        university_options: options,
        university_status: status
      },
      namedInputs: {},
      searchInputs: [input]
    })

    require('../../src/public/scripts/search')
    global.document.triggerReady()

    await input.dispatch('input', {
      target: {
        value: 'Wit'
      }
    })
    await flushMicrotasks()

    input.value = 'Other'
    input.dispatch('change')
    expect(input.validationMessage).toBe('Invalid university selection.')

    input.value = 'University of the Witwatersrand'
    input.dispatch('change')

    expect(global.fetch).toHaveBeenCalledWith('/institutions/universities?query=Wit', {
      headers: {
        Accept: 'application/json'
      }
    })
    expect(options.children).toHaveLength(1)
    expect(options.children[0].value).toBe('University of the Witwatersrand')
    expect(status.textContent).toBe('')
    expect(input.validationMessage).toBe('')
  })

  test('shows an invalid-selection error when no search results are returned', async () => {
    const status = { textContent: '' }
    const options = createOptionsElement()
    const input = createInput({
      describedBy: 'university_status',
      listId: 'university_options',
      name: 'university',
      searchLabel: 'university',
      searchUrl: '/institutions/universities'
    })

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        results: []
      }),
      ok: true
    })
    global.document = createDocument({
      ids: {
        university_options: options,
        university_status: status
      },
      namedInputs: {},
      searchInputs: [input]
    })

    require('../../src/public/scripts/search')
    global.document.triggerReady()

    await input.dispatch('input', {
      target: {
        value: 'Unknown'
      }
    })
    await flushMicrotasks()

    expect(status.textContent).toBe('No results found')
    expect(input.validationMessage).toBe('Invalid university selection.')
  })

  test('clears dependent field state when a parent field changes', () => {
    const parentInput = createInput({
      name: 'university',
      searchLabel: 'university',
      searchUrl: '/institutions/universities',
      value: 'Wits'
    })
    const childStatus = { textContent: 'No results found' }
    const childOptions = createOptionsElement()
    const childInput = createInput({
      describedBy: 'faculty_status',
      listId: 'faculty_options',
      name: 'faculty',
      searchLabel: 'faculty',
      searchParents: 'university',
      searchUrl: '/institutions/faculties',
      value: 'Engineering'
    })

    childInput.setCustomValidity('Invalid faculty selection.')
    childOptions.appendChild({ value: 'Engineering' })

    global.document = createDocument({
      ids: {
        faculty_options: childOptions,
        faculty_status: childStatus
      },
      namedInputs: {
        university: parentInput
      },
      searchInputs: [childInput]
    })

    require('../../src/public/scripts/search')
    global.document.triggerReady()

    parentInput.dispatch('change')

    expect(childInput.value).toBe('')
    expect(childInput.validationMessage).toBe('')
    expect(childStatus.textContent).toBe('')
    expect(childOptions.children).toHaveLength(0)
  })
})
