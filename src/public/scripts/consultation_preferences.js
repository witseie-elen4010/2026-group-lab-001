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
    setStatus(`Autofilled ${responseBody.template.courses.length} courses for ${responseBody.template.degreeName}.`, 'success')
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

document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.profile_update_form:not(.academic_profile_form)')

  if (!form) {
    return
  }

  const statusElement = document.getElementById('institution_status')

  if (!statusElement) {
    return
  }

  let successTimeout = null

  const setStatus = function (message, state) {
    clearTimeout(successTimeout)
    statusElement.classList.remove('institution_status_success', 'institution_status_error')

    if (state) {
      statusElement.classList.add(`institution_status_${state}`)
    }

    statusElement.textContent = message
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault()

    setStatus('Saving...')

    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams(new FormData(form))
    }).catch(function () {
      return null
    })

    if (!response) {
      setStatus('Network error. Please try again.', 'error')
      return
    }

    const data = await response.json().catch(function () {
      return null
    })

    if (!data) {
      setStatus('An unexpected error occurred.', 'error')
      return
    }

    if (data.success) {
      setStatus('Institution updated.', 'success')
      successTimeout = setTimeout(function () {
        setStatus('')
      }, 3000)
    } else {
      setStatus(data.error || 'Could not update institution.', 'error')
    }
  })
})

document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.consultation_preferences_form')
  if (!form) return

  const toggleBtn = document.getElementById('per_day_availability_toggle')
  const perDaySection = document.getElementById('per_day_availability')
  const globalSelect = document.getElementById('global_availability_select')
  const globalStart = document.getElementById('global_start_time')
  const globalEnd = document.getElementById('global_end_time')

  if (!toggleBtn || !perDaySection || !globalSelect || !globalStart || !globalEnd) return

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const syncGlobalToPerDay = function () {
    const availability = globalSelect.value
    const startTime = globalStart.value
    const endTime = globalEnd.value

    DAYS.forEach(function (day) {
      const availSelect = form.querySelector(`[name="availability_${day}"]`)
      const startInput = form.querySelector(`[name="start_time_${day}"]`)
      const endInput = form.querySelector(`[name="end_time_${day}"]`)
      if (availSelect) availSelect.value = availability
      if (startInput) startInput.value = availability === 'available' ? startTime : ''
      if (endInput) endInput.value = availability === 'available' ? endTime : ''
    })
  }

  if (perDaySection.hidden) {
    syncGlobalToPerDay()
  }

  globalSelect.addEventListener('change', function () {
    if (perDaySection.hidden) syncGlobalToPerDay()
  })

  globalStart.addEventListener('change', function () {
    if (perDaySection.hidden) syncGlobalToPerDay()
  })

  globalEnd.addEventListener('change', function () {
    if (perDaySection.hidden) syncGlobalToPerDay()
  })

  toggleBtn.addEventListener('click', function () {
    const isHidden = perDaySection.hidden
    perDaySection.hidden = !isHidden
    toggleBtn.textContent = isHidden ? 'Hide Custom Settings' : 'Set Custom Availability Settings'
    if (!isHidden) {
      syncGlobalToPerDay()
    }
  })
})
