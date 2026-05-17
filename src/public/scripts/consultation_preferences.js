document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.consultation_preferences_form')
  if (!form) return

  const errorContainer = document.querySelector('.consult_pref_error_container')
  const successContainer = document.querySelector('.consult_pref_success_container')
  let successTimeout = null

  /**
   * Displays an error message and hides any visible success message.
   * @param {string} message - Error text to display.
   */
  const showError = function (message) {
    successContainer.hidden = true
    clearTimeout(successTimeout)
    errorContainer.textContent = message
    errorContainer.hidden = false
  }

  const clearError = function () {
    errorContainer.textContent = ''
    errorContainer.hidden = true
  }

  /**
   * Displays a success message that auto-dismisses after 3 seconds.
   */
  const showSuccess = function () {
    clearError()
    successContainer.hidden = false
    successTimeout = setTimeout(function () {
      successContainer.hidden = true
    }, 3000)
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault()

    const res = await fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams(new FormData(form))
    }).catch(function () { return null })

    if (!res) {
      showError('Network error. Please try again.')
      return
    }

    const data = await res.json().catch(function () { return null })

    if (!data) {
      showError('An unexpected error occurred.')
      return
    }

    if (data.success) {
      showSuccess()
    } else {
      showError(data.error)
    }
  })
})

document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.academic_profile_form')

  if (!form) {
    return
  }

  const degreeInput = document.getElementById('academic_profile_degree')
  const coursesInput = document.getElementById('academic_profile_courses')
  const autofillButton = document.getElementById('academic_profile_autofill')
  const saveButton = document.getElementById('academic_profile_save')
  const statusElement = document.getElementById('academic_profile_status')

  if (!degreeInput || !coursesInput || !autofillButton || !saveButton || !statusElement) {
    return
  }

  const setStatus = function (message, state = '') {
    statusElement.classList.remove('academic_profile_status_error', 'academic_profile_status_success')

    if (state) {
      statusElement.classList.add(`academic_profile_status_${state}`)
    }

    statusElement.textContent = message
  }

  const fetchTemplate = async function () {
    const degree = degreeInput.value.trim()

    if (!degree) {
      setStatus('Enter a degree to preview suggested Wits courses.')
      return
    }

    setStatus('Looking up Wits courses...')

    const params = new URLSearchParams({ degree })
    const response = await fetch(`${form.dataset.templateUrl}?${params.toString()}`, {
      headers: {
        Accept: 'application/json'
      }
    }).catch(function () {
      return null
    })

    if (!response || !response.ok) {
      setStatus('Could not load suggested courses right now.', 'error')
      return
    }

    const responseBody = await response.json().catch(function () {
      return null
    })

    if (!responseBody || !responseBody.matched || !responseBody.template) {
      setStatus('No Wits course template was found for that degree. You can enter courses manually.')
      return
    }

    coursesInput.value = responseBody.template.courses.join('\n')
    setStatus(`Autofilled ${responseBody.template.courses.length} suggested courses for ${responseBody.template.degreeName}.`, 'success')
  }

  const saveAcademicProfile = async function () {
    setStatus('Saving academic profile...')

    const response = await fetch(form.dataset.saveUrl, {
      body: new URLSearchParams({
        courses: coursesInput.value,
        degree: degreeInput.value.trim()
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      method: 'PATCH'
    }).catch(function () {
      return null
    })

    if (!response) {
      setStatus('Could not save your academic profile right now.', 'error')
      return
    }

    const responseBody = await response.json().catch(function () {
      return null
    })

    if (!response.ok || !responseBody || !responseBody.success) {
      setStatus(responseBody?.error || 'Could not save your academic profile right now.', 'error')
      return
    }

    degreeInput.value = responseBody.profile.degree
    coursesInput.value = responseBody.profile.courses.join('\n')
    setStatus('Academic profile saved.', 'success')
  }

  autofillButton.addEventListener('click', fetchTemplate)
  saveButton.addEventListener('click', saveAcademicProfile)

  degreeInput.addEventListener('change', function () {
    if (coursesInput.value.trim()) {
      setStatus('Degree updated. Click Autofill Courses to replace the current course list.')
      return
    }

    fetchTemplate()
  })

  if (degreeInput.value.trim() && !coursesInput.value.trim()) {
    fetchTemplate()
  }
})
