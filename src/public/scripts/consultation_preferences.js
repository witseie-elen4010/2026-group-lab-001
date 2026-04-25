document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.consultation_preferences_form')
  if (!form) return

  const errorContainer = document.querySelector('.consult_pref_error_container')
  const successContainer = document.querySelector('.consult_pref_success_container')
  let successTimeout = null

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
