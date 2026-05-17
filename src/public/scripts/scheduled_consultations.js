document.addEventListener('DOMContentLoaded', function () {
  const cancelButtons = document.querySelectorAll('[data-cancel-id]')

  if (cancelButtons.length === 0) {
    return
  }

  const handleCancel = async function (consultationId) {
    if (!window.confirm('Are you sure you want to cancel this consultation?')) {
      return
    }

    try {
      const response = await fetch(`/consultations/${consultationId}`, {
        method: 'DELETE'
      })
      const data = await response.json().catch(function () {
        return null
      })

      if (!response.ok || !data || !data.success) {
        window.alert(data && data.error ? data.error : 'Unable to cancel consultation right now.')
        return
      }

      window.location.reload()
    } catch {
      window.alert('Unable to cancel consultation right now.')
    }
  }

  cancelButtons.forEach(function (cancelButton) {
    cancelButton.addEventListener('click', function () {
      handleCancel(cancelButton.dataset.cancelId)
    })
  })
})
