document.addEventListener('DOMContentLoaded', function () {
  const searchInputs = Array.from(document.querySelectorAll('[data-search-url]'))

  if (searchInputs.length === 0) {
    return
  }
  const searchStates = new Map()

  const getStatusElement = function (input) {
    const describedBy = input.getAttribute('aria-describedby')
    return describedBy ? document.getElementById(describedBy) : null
  }

  const getOptionsElement = function (input) {
    const optionsListId = input.getAttribute('list')
    return optionsListId ? document.getElementById(optionsListId) : null
  }

  const getSearchParents = function (input) {
    return (input.dataset.searchParents || '')
      .split(',')
      .map(function (fieldName) {
        return fieldName.trim()
      })
      .filter(Boolean)
  }

  const buildInvalidSelectionMessage = function (input) {
    const fieldLabel = input.dataset.searchLabel || input.name || 'value'

    return `Invalid ${fieldLabel} selection.`
  }

  const renderOptions = function (input, results) {
    const optionsElement = getOptionsElement(input)

    if (!optionsElement) {
      return
    }

    while (optionsElement.firstChild) {
      optionsElement.removeChild(optionsElement.firstChild)
    }

    results.forEach(function (universityName) {
      const option = document.createElement('option')
      option.value = universityName
      optionsElement.appendChild(option)
    })
  }

  const applyResults = function (input, query, results) {
    const statusElement = getStatusElement(input)
    const searchState = searchStates.get(input)

    if (!statusElement || !searchState) {
      return
    }

    searchState.latestResults = results
    renderOptions(input, results)

    if (!query) {
      statusElement.textContent = ''
      input.setCustomValidity('')
      return
    }

    if (results.length === 0) {
      statusElement.textContent = 'No results found'
      input.setCustomValidity(buildInvalidSelectionMessage(input))
      return
    }

    statusElement.textContent = ''
    input.setCustomValidity('')
  }

  const searchValues = async function (input, query) {
    const normalizedQuery = query.trim()
    const searchState = searchStates.get(input)
    const searchParameters = new URLSearchParams({ query: normalizedQuery })

    searchState.searchRequestNumber += 1
    const currentSearchRequestNumber = searchState.searchRequestNumber

    getSearchParents(input).forEach(function (parentFieldName) {
      const parentInput = document.querySelector(`[name="${parentFieldName}"]`)
      const parentValue = parentInput?.value?.trim() || ''

      if (parentValue) {
        searchParameters.set(parentFieldName, parentValue)
      }
    })

    if (!normalizedQuery) {
      applyResults(input, '', [])
      return
    }

    try {
      const response = await fetch(
        `${input.dataset.searchUrl}?${searchParameters.toString()}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('University search request failed.')
      }

      const responseBody = await response.json()

      if (currentSearchRequestNumber !== searchState.searchRequestNumber) {
        return
      }

      applyResults(
        input,
        normalizedQuery,
        Array.isArray(responseBody.results) ? responseBody.results : []
      )
    } catch (error) {
      if (currentSearchRequestNumber !== searchState.searchRequestNumber) {
        return
      }

      applyResults(input, normalizedQuery, [])
    }
  }

  searchInputs.forEach(function (input) {
    searchStates.set(input, {
      latestResults: [],
      searchRequestNumber: 0
    })

    input.addEventListener('input', function (event) {
      searchValues(input, event.target.value)
    })

    input.addEventListener('change', function () {
      const searchState = searchStates.get(input)
      const selectedValue = input.value.trim()

      if (!selectedValue || searchState.latestResults.includes(selectedValue)) {
        input.setCustomValidity('')
        return
      }

      input.setCustomValidity(buildInvalidSelectionMessage(input))
    })

    getSearchParents(input).forEach(function (parentFieldName) {
      const parentInput = document.querySelector(`[name="${parentFieldName}"]`)

      if (!parentInput) {
        return
      }

      parentInput.addEventListener('change', function () {
        input.value = ''
        applyResults(input, '', [])
      })
    })

    if (input.value.trim()) {
      searchValues(input, input.value)
    }
  })
})
