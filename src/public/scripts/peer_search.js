document.addEventListener('DOMContentLoaded', function () {
  const toggleSection = function (btn, section) {
    if (!btn || !section) {
      return
    }
    btn.addEventListener('click', function () {
      const isHidden = section.classList.contains('is_hidden')
      if (isHidden) {
        section.classList.remove('is_hidden')
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        const firstInput = section.querySelector('input, select')
        if (firstInput) {
          firstInput.focus()
        }
      } else {
        section.classList.add('is_hidden')
      }
    })
  }

  toggleSection(
    document.getElementById('peer_search_btn'),
    document.getElementById('peer_search_section')
  )

  toggleSection(
    document.getElementById('lecturer_search_btn'),
    document.getElementById('lecturer_search_section')
  )
})
