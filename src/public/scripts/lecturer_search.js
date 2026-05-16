document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('lecturer_search_form')
  const resultsSection = document.getElementById('lecturer_results')
  const canFollow = resultsSection?.dataset.canFollow === 'true'

  if (!form || !resultsSection) {
    return
  }

  const escapeHtml = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const buildLecturerCardHtml = function (lecturer) {
    const href = `/user_profile?user=${encodeURIComponent(lecturer.username)}`
    const details = `${escapeHtml(lecturer.firstName)} ${escapeHtml(lecturer.lastName)} &mdash; ${escapeHtml(lecturer.facultyId)}, ${escapeHtml(lecturer.schoolId)}`
    let followAction = ''

    if (canFollow) {
      if (lecturer.isFollowed) {
        followAction = '<span class="lecturer_result_following">Following</span>'
      } else {
        followAction = `<form class="lecturer_result_follow_form" action="/users/${encodeURIComponent(lecturer.username)}/follow" method="post"><button type="submit">Follow</button></form>`
      }
    }

    return `<article class="lecturer_result_card"><a class="lecturer_result_link" href="${href}">${details}</a>${followAction}</article>`
  }

  const buildResultsHtml = function ({ lecturers, page, totalPages }, params) {
    if (lecturers.length === 0) {
      return '<p>No lecturers found.</p>'
    }

    const lecturerLinks = lecturers.map(buildLecturerCardHtml).join('')

    if (totalPages <= 1) {
      return lecturerLinks
    }

    const pageLinks = []
    for (let i = 1; i <= totalPages; i++) {
      const pageParams = new URLSearchParams(params)
      pageParams.set('page', i)
      const activeClass = i === page ? ' pagination_link_active' : ''
      pageLinks.push(`<a href="/home?${pageParams}" class="pagination_link${activeClass}" data-page="${i}">${i}</a>`)
    }

    return `${lecturerLinks}<nav class="pagination">${pageLinks.join('')}</nav>`
  }

  const syncFormToParams = function (params) {
    form.elements.q.value = params.get('q') || ''
    if (form.elements.facultyId) form.elements.facultyId.value = params.get('facultyId') || ''
    if (form.elements.schoolId) form.elements.schoolId.value = params.get('schoolId') || ''
  }

  const fetchAndRender = async function (params) {
    try {
      const response = await fetch(`/home?${params}`, {
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      resultsSection.innerHTML = buildResultsHtml(data, params)
    } catch {
      // retain existing results on network error
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault()
    const params = new URLSearchParams(new FormData(form))
    params.delete('page')
    window.history.pushState(null, '', `/home?${params}`)
    await fetchAndRender(params)
  })

  resultsSection.addEventListener('click', async function (event) {
    const link = event.target.closest('[data-page]')
    if (!link) {
      return
    }
    event.preventDefault()
    const params = new URLSearchParams(new FormData(form))
    params.set('page', link.dataset.page)
    window.history.pushState(null, '', `/home?${params}`)
    await fetchAndRender(params)
  })

  window.addEventListener('popstate', async function () {
    const params = new URLSearchParams(window.location.search)
    syncFormToParams(params)
    await fetchAndRender(params)
  })
})
