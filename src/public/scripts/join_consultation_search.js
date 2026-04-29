document.addEventListener('DOMContentLoaded', function () {
  const JOIN_ERROR = 'Unable to join consultation right now.'
  const feedback = document.getElementById('join_consultation_feedback')
  const resultsSection = document.getElementById('join_consultation_results')

  if (!feedback || !resultsSection) {
    return
  }

  const showFeedback = function (type, message) {
    feedback.className = type
    feedback.textContent = message
  }

  resultsSection.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-join-id]')
    if (!button) {
      return
    }

    button.disabled = true

    try {
      const response = await fetch(`/join_consultation/${button.dataset.joinId}/join`, {
        headers: { Accept: 'application/json' },
        method: 'POST'
      })
      const data = await response.json()

      if (!response.ok) {
        showFeedback('error', data.error || JOIN_ERROR)
        return
      }

      window.location.assign('/join_consultation')
    } catch {
      showFeedback('error', JOIN_ERROR)
    } finally {
      button.disabled = false
    }
  })
})
