const flushPromises = function () {
  return new Promise((resolve) => setImmediate(resolve))
}

const createInput = function ({
  name = 'university',
  searchLabel = 'university',
  searchParents = '',
  searchUrl = '/institutions/universities',
  value = ''
} = {}) {
  const listeners = {}
  const attributes = {
    'aria-describedby': `${name}_status`,
    list: `${name}_options`
  }

  return {
    dataset: {
      searchLabel,
      searchParents,
      searchUrl
    },
    listeners,
    name,
    validationMessage: '',
    value,
    addEventListener: function (eventName, handler) {
      listeners[eventName] = handler
    },
    getAttribute: function (attributeName) {
      return attributes[attributeName] || null
    },
    setCustomValidity: function (message) {
      this.validationMessage = message
    }
  }
}

const createOptionsElement = function () {
  const children = []

  return {
    get firstChild () {
      return children[0] || null
    },
    appendChild: function (child) {
      children.push(child)
    },
    children,
    removeChild: function (child) {
      const index = children.indexOf(child)

      if (index >= 0) {
        children.splice(index, 1)
      }
    }
  }
}

const loadScript = function ({ document }) {
  jest.resetModules()
  global.document = document
  require('../../../src/public/scripts/search')
}

describe('institution search input script', () => {
  afterEach(() => {
    delete global.document
    delete global.fetch
  })

  test('returns early when no searchable inputs are present', () => {
    const domReadyListeners = {}

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      }
    })

    expect(() => domReadyListeners.DOMContentLoaded()).not.toThrow()
  })

  test('loads initial results for pre-filled search values', async () => {
    const domReadyListeners = {}
    const input = createInput({ value: 'wit' })
    const statusElement = { textContent: '' }
    const optionsElement = createOptionsElement()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        results: ['University of the Witwatersrand']
      })
    })

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        createElement: jest.fn().mockImplementation(function () {
          return { value: '' }
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'university_status') {
            return statusElement
          }
          if (id === 'university_options') {
            return optionsElement
          }
          return null
        }),
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([input])
      }
    })

    domReadyListeners.DOMContentLoaded()
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/institutions/universities?query=wit', {
      headers: {
        Accept: 'application/json'
      }
    })
    expect(optionsElement.children.map((child) => child.value)).toEqual(['University of the Witwatersrand'])
    expect(input.validationMessage).toBe('')
  })

  test('shows no-result validation and clears child inputs when a parent changes', async () => {
    const domReadyListeners = {}
    const parentInput = {
      listeners: {},
      value: 'Engineering',
      addEventListener: function (eventName, handler) {
        this.listeners[eventName] = handler
      }
    }
    const input = createInput({
      name: 'school',
      searchLabel: 'school',
      searchParents: 'faculty',
      searchUrl: '/institutions/schools'
    })
    const statusElement = { textContent: '' }
    const optionsElement = createOptionsElement()

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn()
    })

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        createElement: jest.fn().mockImplementation(function () {
          return { value: '' }
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'school_status') {
            return statusElement
          }
          if (id === 'school_options') {
            return optionsElement
          }
          return null
        }),
        querySelector: jest.fn(function (selector) {
          if (selector === '[name="faculty"]') {
            return parentInput
          }
          return null
        }),
        querySelectorAll: jest.fn().mockReturnValue([input])
      }
    })

    domReadyListeners.DOMContentLoaded()
    await input.listeners.input({
      target: {
        value: 'elect'
      }
    })
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/institutions/schools?query=elect&faculty=Engineering', {
      headers: {
        Accept: 'application/json'
      }
    })
    expect(statusElement.textContent).toBe('No results found')
    expect(input.validationMessage).toBe('Invalid school selection.')

    input.value = 'Custom School'
    input.listeners.change()
    expect(input.validationMessage).toBe('Invalid school selection.')

    parentInput.listeners.change()
    expect(input.value).toBe('')
    expect(statusElement.textContent).toBe('')
  })

  test('clears validation when the query is blank', async () => {
    const domReadyListeners = {}
    const input = createInput({ name: 'university' })
    const statusElement = { textContent: 'No results found' }
    const optionsElement = createOptionsElement()

    input.validationMessage = 'Invalid university selection.'

    loadScript({
      document: {
        addEventListener: jest.fn(function (eventName, handler) {
          domReadyListeners[eventName] = handler
        }),
        createElement: jest.fn().mockImplementation(function () {
          return { value: '' }
        }),
        getElementById: jest.fn(function (id) {
          if (id === 'university_status') {
            return statusElement
          }
          if (id === 'university_options') {
            return optionsElement
          }
          return null
        }),
        querySelector: jest.fn().mockReturnValue(null),
        querySelectorAll: jest.fn().mockReturnValue([input])
      }
    })

    domReadyListeners.DOMContentLoaded()
    await input.listeners.input({
      target: {
        value: '   '
      }
    })

    expect(statusElement.textContent).toBe('')
    expect(input.validationMessage).toBe('')
  })
})
