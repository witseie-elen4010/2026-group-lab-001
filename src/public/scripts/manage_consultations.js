document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('manage_consultations_btn')
  const dialog = document.getElementById('manage_consultations_dialog')
  const closeBtn = document.getElementById('close_manage_dialog')
  const list = document.getElementById('manage_consultations_list')
  const msg = document.getElementById('manage_consultations_msg')

  if (!btn || !dialog || !closeBtn || !list || !msg) {
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

  const buildConsultationCard = function (consultation) {
    const article = document.createElement('article')
    article.className = 'dashboard_consultation_card'
    article.dataset.consultationId = consultation.id

    const title = document.createElement('h3')
    title.textContent = consultation.name
    article.appendChild(title)

    const lecturer = document.createElement('p')
    lecturer.className = 'dashboard_consultation_meta'
    lecturer.textContent = `Lecturer: ${consultation.lecturer}`
    article.appendChild(lecturer)

    const dateTime = document.createElement('p')
    dateTime.className = 'dashboard_consultation_meta'
    dateTime.textContent = `Date: ${consultation.date} · Time: ${consultation.time}`
    article.appendChild(dateTime)

    if (consultation.isOrganiser) {
      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.className = 'back_link'
      cancelBtn.style.marginTop = '12px'
      cancelBtn.textContent = 'Cancel Consultation'
      cancelBtn.dataset.cancelId = consultation.id
      article.appendChild(cancelBtn)
    }

    return article
  }

  const loadConsultations = async function () {
    list.innerHTML = '<p>Loading…</p>'
    hideMsg()

    try {
      const response = await fetch('/consultations')
      const data = await response.json()

      if (!response.ok || !Array.isArray(data.consultations)) {
        list.innerHTML = '<p>Unable to load consultations right now.</p>'
        return
      }

      if (data.consultations.length === 0) {
        list.innerHTML = '<p>You have no upcoming consultations.</p>'
        return
      }

      list.innerHTML = ''
      data.consultations.forEach(function (consultation) {
        list.appendChild(buildConsultationCard(consultation))
      })
    } catch {
      list.innerHTML = '<p>Unable to load consultations right now.</p>'
    }
  }

  const handleCancel = async function (consultationId) {
    if (!window.confirm('Are you sure you want to cancel this consultation? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/consultations/${consultationId}`, { method: 'DELETE' })
      const data = await response.json()

      if (response.ok && data.success) {
        showMsg('Consultation cancelled successfully.', false)
        setTimeout(function () { window.location.reload() }, 1000)
      } else {
        showMsg(data.error || 'Unable to cancel consultation.', true)
      }
    } catch {
      showMsg('Unable to cancel consultation right now.', true)
    }
  }

  list.addEventListener('click', function (event) {
    const cancelBtn = event.target.closest('[data-cancel-id]')
    if (!cancelBtn) return
    handleCancel(cancelBtn.dataset.cancelId)
  })

  btn.addEventListener('click', function () {
    loadConsultations()
    dialog.showModal()
  })

  closeBtn.addEventListener('click', function () {
    dialog.close()
  })

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) {
      dialog.close()
    }
  })
})
