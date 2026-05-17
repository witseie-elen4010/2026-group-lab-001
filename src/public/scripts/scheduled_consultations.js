document.addEventListener('DOMContentLoaded', function () {
  const cancelButtons = document.querySelectorAll('[data-cancel-id]')
  const msg = document.getElementById('scheduled_consultations_msg')

  if (cancelButtons.length === 0 || !msg) {
    return
  }

  const showMsg = function (text, isError) {
    msg.textContent = text
    msg.className = isError ? 'error' : 'success'
  }

  const hideMsg = function () {
    msg.textContent = ''
    msg.className = 'is_hidden'
  }

  /**
   * Sends a cancellation request for the selected consultation.
   * @param {string} consultationId - Consultation identifier.
   * @returns {Promise<void>}
   */
  const handleCancel = async function (consultationId) {
    if (!window.confirm('Are you sure you want to cancel this consultation?')) {
      return
    }

    hideMsg()

    try {
      const response = await fetch(`/consultations/${consultationId}`, {
        method: 'DELETE'
      })
      const data = await response.json().catch(function () {
        return null
      })

      if (!response.ok || !data || !data.success) {
        showMsg(data && data.error ? data.error : 'Unable to cancel consultation right now.', true)
        return
      }

      showMsg('Consultation cancelled successfully.', false)
      setTimeout(function () {
        window.location.reload()
      }, 1000)
    } catch {
      showMsg('Unable to cancel consultation right now.', true)
    }
  }

  cancelButtons.forEach(function (cancelButton) {
    cancelButton.addEventListener('click', function () {
      handleCancel(cancelButton.dataset.cancelId)
    })
  })
})
