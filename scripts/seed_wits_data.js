require('dotenv').config()
const axios = require('axios')
const cheerio = require('cheerio')
const { MongoClient } = require('mongodb')
const { hashPassword } = require('../src/utils/password')

const BASE_URL = 'https://www.wits.ac.za'
const UNIVERSITY_NAME = 'University of the Witwatersrand'
const REQUEST_DELAY_MS = 700

const TITLE_PATTERN = /^(?:(?:adjunct|associate|emeritus)\s+)?(?:prof(?:essor)?\.?|a\/prof\.?|doctor|dr\.?|mr\.?|ms\.?|mrs\.?|rev\.?)\s+/i

const sleep = function (ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms) })
}

const fetchPage = async function (url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'LetsTalkSeedScript/1.0' },
    timeout: 15000
  })
  return cheerio.load(response.data)
}

const stripTitles = function (name) {
  let cleaned = name.trim()
    .replace(/\s*\([^)]*\)/g, '') // remove (Dr), (nickname), etc.
    .replace(/\s+[Hh]ead\s+[Oo]f\b.*/i, '') // remove "Head of Division: ..." role suffix
    .trim()
  let previous
  do {
    previous = cleaned
    cleaned = cleaned.replace(TITLE_PATTERN, '').trim()
  } while (cleaned !== previous)
  return cleaned
}

const getInitials = function (cleanedName) {
  return cleanedName
    .split(/\s+/)
    .filter(function (word) { return /^[A-Za-z]/.test(word) })
    .map(function (word) { return word[0].toUpperCase() })
    .join('')
}

const parseName = function (cleanedName) {
  const parts = cleanedName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

const makeUsername = function (initials, usedUsernames) {
  let candidate = `${initials}atWits`
  let counter = 2
  while (usedUsernames.has(candidate)) {
    candidate = `${initials}atWits${counter}`
    counter++
  }
  return candidate
}

const makePassword = function (username) {
  return username.replace('atWits', '')
}

const AFFILIATED_STAFF_URLS = {
  'https://www.wbs.ac.za/': 'https://www.wbs.ac.za/faculty',
  'https://www.wsg.ac.za/': 'https://www.wsg.ac.za/people'
}

// Schools whose staff page is not at the default <schoolPath>staff/ URL
const SCHOOL_STAFF_URL_OVERRIDES = {
  '/gaes/': `${BASE_URL}/gaes/staff/academic-staff/`,
  '/mia/': `${BASE_URL}/mia/about-the-school/staff/`,
  '/sef/': `${BASE_URL}/sef/people/`
}

// Schools where only one named accordion section should be seeded
const SCHOOLS_H4_SECTION_FILTER = {
  '/miningeng/': /visiting and emeritus/i
}

// Schools whose staff is too dispersed to seed — existing records are removed
const SCHOOLS_TO_SKIP = new Set(['/clinicalmed/', '/oralhealthsciences/', '/pathology/'])

// Faculties too dispersed to seed — all schools in these faculties are skipped and removed
const FACULTIES_TO_SKIP = new Set(['Humanities'])

// Per-school name exclusions applied after title-stripping (e.g. deceased staff listed in memoriam)
const SCHOOL_NAME_EXCLUSIONS = {
  '/geosciences/': new Set(['Lewis Ashwal'])
}

const ACADEMIC_ROLE_PATTERN = /lecturer|professor|research|head of|curator|emeritus/i

const scrapePhysiology = async function (url) {
  const $ = await fetchPage(url)
  const names = []
  const tabHref = $('ul.tabs a').filter(function () {
    return /academic staff/i.test($(this).text())
  }).attr('href')
  if (!tabHref) return names
  const tabId = tabHref.slice(1)
  $(`[id="${tabId}"] p strong`).each(function (_, el) {
    const name = $(el).text().trim()
    if (name) names.push(name)
  })
  return names
}

const scrapeAnatomicalSciences = async function (url) {
  const $ = await fetchPage(url)
  const names = []
  $('table td').each(function (_, td) {
    const strong = $(td).children('strong')
    if (!strong.length) return
    const name = strong.text().trim()
    if (!name) return
    let role = ''
    $(td).closest('tr').nextAll('tr').slice(0, 5).each(function (_, tr) {
      const text = $(tr).text().trim()
      if (text && !/^(tel:|email:|fax:|&nbsp;)/i.test(text) && text.length > 2) {
        role = text; return false
      }
    })
    if (ACADEMIC_ROLE_PATTERN.test(role)) names.push(name)
  })
  return names
}

const scrapeTherapeuticSciences = function ($) {
  const names = []
  $('h5').each(function (_, el) {
    const pText = $(el).next('p').text().trim()
    if (/^(senior\s+)?lecturer/i.test(pText)) {
      const name = $(el).text().trim()
      if (name) names.push(name)
    }
  })
  return names
}

const normalizeSchoolPath = function (href) {
  if (!href) return null
  if (href.startsWith('/')) return href
  const witsRelative = href.match(/^https?:\/\/www\.wits\.ac\.za(\/.*)/i)
  if (witsRelative) return witsRelative[1]
  // Normalise http → https so AFFILIATED_STAFF_URLS keys always match
  const normalised = href.replace(/^http:\/\//i, 'https://')
  if (AFFILIATED_STAFF_URLS[normalised]) return normalised
  return null
}

const scrapeFacultiesAndSchools = async function () {
  const $ = await fetchPage(`${BASE_URL}/faculties-and-schools/`)
  const faculties = []

  $('div.feature-block').each(function (_, block) {
    const facultyName = $(block).find('h2 a').text().trim()
    const seenPaths = new Set()
    const schools = []

    $(block).find('div.feature-content strong a').each(function (_, link) {
      const schoolName = $(link).text().trim()
      const schoolPath = normalizeSchoolPath($(link).attr('href'))
      if (schoolName && schoolPath && !seenPaths.has(schoolPath)) {
        seenPaths.add(schoolPath)
        schools.push({ name: schoolName, path: schoolPath })
      }
    })

    if (facultyName) {
      faculties.push({ name: facultyName, schools })
    }
  })

  return faculties
}

const scrapeStaffNamesAffiliated = async function (staffUrl) {
  try {
    const names = []
    let currentUrl = staffUrl
    while (currentUrl) {
      const $ = await fetchPage(currentUrl)
      // If the page has an "Academic Staff" heading, scope collection to that section only.
      // Otherwise (e.g. WBS which has no such heading) collect all h3 elements.
      const hasAcademicSection = $('h2').filter(function () {
        return /academic staff/i.test($(this).text())
      }).length > 0
      let inSection = !hasAcademicSection

      $('h2, h3').each(function (_, el) {
        const tag = $(el)[0].tagName.toLowerCase()
        const text = $(el).text().trim()
        if (tag === 'h2') {
          if (hasAcademicSection) inSection = /academic staff/i.test(text)
          return
        }
        if (inSection && text.includes(' ') && !text.includes('?')) names.push(text)
      })

      const nextHref = $('a[rel="next"]').attr('href')
      currentUrl = nextHref ? new URL(nextHref, currentUrl).href : null
      if (nextHref) await sleep(REQUEST_DELAY_MS)
    }
    return names
  } catch {
    return []
  }
}

const PEOPLE_LINK_SELECTOR = 'a[href*="/people/academic-a-z-listing/"], a[href*="/people/professional-and-administrative-a-z-listing/"]'

const CHEMISTRY_LINK_SELECTOR = 'a[href*="/staff/academic-a-z-listing/"]'

// Chemistry: most staff linked via /staff/academic-a-z-listing/; a few emeritus are plain <p><strong> with title prefix
const scrapeChemistry = function ($) {
  const names = []
  const seen = new Set()
  $('p').each(function (_, el) {
    const link = $(el).find(CHEMISTRY_LINK_SELECTOR)
    if (link.length) {
      const name = link.find('strong').text().trim() || link.text().trim()
      if (name && !seen.has(name)) { seen.add(name); names.push(name) }
      return
    }
    $(el).children('strong').each(function (_, strong) {
      const text = $(strong).text().trim()
      if (TITLE_PATTERN.test(text) && !seen.has(text)) { seen.add(text); names.push(text) }
    })
  })
  return names
}

// GAES: names in <li><a people-link><strong>Name</strong></a></li>
const scrapeGAES = function ($) {
  const names = []
  const seen = new Set()
  $(PEOPLE_LINK_SELECTOR).each(function (_, link) {
    if (!$(link).closest('li').length) return
    const name = $(link).find('strong').text().trim() || $(link).text().trim()
    if (name && !seen.has(name)) { seen.add(name); names.push(name) }
  })
  return names
}

const scrapeStaffNames = async function (schoolPath) {
  if (SCHOOLS_TO_SKIP.has(schoolPath)) return []

  const affiliatedUrl = AFFILIATED_STAFF_URLS[schoolPath]
  if (affiliatedUrl) return scrapeStaffNamesAffiliated(affiliatedUrl)

  if (schoolPath === '/biomedicalsciences/') {
    await sleep(REQUEST_DELAY_MS)
    const [physNames, anatNames] = await Promise.all([
      scrapePhysiology(`${BASE_URL}/physiology/staff/`),
      scrapeAnatomicalSciences(`${BASE_URL}/anatomicalsciences/staff/`)
    ])
    const seen = new Set()
    return [...physNames, ...anatNames].filter(function (n) {
      return n && !seen.has(n) && seen.add(n)
    })
  }

  const url = SCHOOL_STAFF_URL_OVERRIDES[schoolPath] || `${BASE_URL}${schoolPath}staff/`
  try {
    const $ = await fetchPage(url)

    if (schoolPath === '/chemistry/') return scrapeChemistry($)
    if (schoolPath === '/gaes/') return scrapeGAES($)
    if (schoolPath === '/therapeuticsciences/') return scrapeTherapeuticSciences($)

    const names = []

    // Pass 1: standard Wits layout — names in <p> or <h5> linking to a people listing
    // (h5 covers SOAP / Architecture and Planning)
    $('p, h5').each(function (_, el) {
      const link = $(el).find(PEOPLE_LINK_SELECTOR)
      if (!link.length) return
      const rawName = link.find('strong').text().trim() || link.text().trim()
      if (rawName) names.push(rawName)
    })

    if (names.length > 0) return names

    // Pass 2: card-based layout — name in .card-heading inside a people link (ChemMet)
    const cardSeen = new Set()
    $(PEOPLE_LINK_SELECTOR).each(function (_, el) {
      const name = $(el).find('.card-heading').text().trim()
      if (name && !cardSeen.has(name)) { cardSeen.add(name); names.push(name) }
    })

    if (names.length > 0) return names

    // Pass 3: h4-based layouts (SBS, SEF, Mining Engineering)
    const seen = new Set()
    const sectionFilter = SCHOOLS_H4_SECTION_FILTER[schoolPath]

    if (sectionFilter) {
      // Collect h4s only from the matching accordion section
      $('dd.accordion-navigation').each(function (_, dd) {
        if (sectionFilter.test($(dd).find('> a').first().text())) {
          $(dd).find('h4').each(function (_, h4) {
            const text = $(h4).text().trim()
            if (text && !seen.has(text)) { seen.add(text); names.push(text) }
          })
        }
      })
    } else {
      // Collect h4s before any h3 section header (admin/service sections),
      // plus any h4 that links directly to a people listing (e.g. visiting fellows).
      let stopPlain = false
      $('h3, h4').each(function (_, el) {
        const tag = $(el)[0].tagName.toLowerCase()
        const text = $(el).text().trim()
        if (tag === 'h3') { stopPlain = true; return }
        const link = $(el).find(PEOPLE_LINK_SELECTOR)
        if (link.length) {
          const name = link.find('strong').text().trim() || link.text().trim()
          if (name && !seen.has(name)) { seen.add(name); names.push(name) }
          return
        }
        if (!stopPlain && text && !seen.has(text)) { seen.add(text); names.push(text) }
      })
    }

    return names
  } catch {
    return []
  }
}

const run = async function () {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env')
    process.exit(1)
  }

  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db('LetsTalk')

  const universitiesCol = db.collection('University')
  const facultiesCol = db.collection('Faculty')
  const schoolsCol = db.collection('School')
  const usersCol = db.collection('User')

  const universityDoc = await universitiesCol.findOneAndUpdate(
    { name: UNIVERSITY_NAME },
    { $setOnInsert: { city: 'Johannesburg', country: 'South Africa', name: UNIVERSITY_NAME } },
    { upsert: true, returnDocument: 'after' }
  )
  const universityId = universityDoc._id
  console.log(`University: ${UNIVERSITY_NAME}`)

  const usedUsernames = new Set(
    (await usersCol.find({}, { projection: { username: 1 } }).toArray())
      .map(function (u) { return u.username })
  )

  const existingLecturerKeys = new Set(
    (await usersCol.find({ role: 'lecturer' }, { projection: { firstName: 1, lastName: 1, schoolId: 1 } }).toArray())
      .map(function (u) { return `${u.firstName}|${u.lastName}|${u.schoolId}` })
  )

  const facultyData = await scrapeFacultiesAndSchools()
  console.log(`Scraped ${facultyData.length} faculties\n`)

  for (const faculty of facultyData) {
    if (FACULTIES_TO_SKIP.has(faculty.name)) {
      console.log(`Faculty: ${faculty.name} — skipped`)
      continue
    }

    const facultyDoc = await facultiesCol.findOneAndUpdate(
      { name: faculty.name },
      { $setOnInsert: { name: faculty.name, universityId, universityName: UNIVERSITY_NAME } },
      { upsert: true, returnDocument: 'after' }
    )
    const facultyId = facultyDoc._id
    console.log(`Faculty: ${faculty.name}`)

    for (const school of faculty.schools) {
      await sleep(REQUEST_DELAY_MS)

      if (SCHOOLS_TO_SKIP.has(school.path)) {
        console.log(`  School: ${school.name} — skipped`)
        continue
      }

      await schoolsCol.findOneAndUpdate(
        { name: school.name },
        { $setOnInsert: { facultyId, facultyName: faculty.name, name: school.name, universityId, universityName: UNIVERSITY_NAME } },
        { upsert: true, returnDocument: 'after' }
      )
      console.log(`  School: ${school.name}`)

      const rawNames = await scrapeStaffNames(school.path)
      await sleep(REQUEST_DELAY_MS)

      let addedCount = 0
      const exclusions = SCHOOL_NAME_EXCLUSIONS[school.path] || new Set()

      for (const rawName of rawNames) {
        const cleanedName = stripTitles(rawName)
        if (exclusions.has(cleanedName)) continue
        const initials = getInitials(cleanedName)
        if (!initials) continue

        const { firstName, lastName } = parseName(cleanedName)
        if (existingLecturerKeys.has(`${firstName}|${lastName}|${school.name}`)) continue
        const username = makeUsername(initials, usedUsernames)
        usedUsernames.add(username)

        const password = makePassword(username)
        const passwordHash = await hashPassword(password)
        const email = `${username.toLowerCase()}@wits.ac.za`

        await usersCol.updateOne(
          { username },
          {
            $setOnInsert: {
              email,
              facultyId: faculty.name,
              firstName,
              lastName,
              passwordHash,
              role: 'lecturer',
              schoolId: school.name,
              universityId: UNIVERSITY_NAME,
              username
            }
          },
          { upsert: true }
        )
        addedCount++
      }

      console.log(`    ${addedCount} lecturers seeded`)
    }
  }

  console.log('\nSeed complete.')
  await client.close()
}

run().catch(function (err) {
  console.error('Seed failed:', err)
  process.exit(1)
})
