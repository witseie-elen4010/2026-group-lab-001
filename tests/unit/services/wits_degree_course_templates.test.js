const {
  buildWitsDegreeTemplateAuditReport,
  findWitsDegreeCourseTemplate,
  getWitsDegreeCourseTemplates,
  normalizeDegreeName,
  WITS_DEGREE_COURSE_TEMPLATES
} = require('../../../src/services/wits_degree_course_templates')

describe('wits degree course templates', () => {
  test('normalizes degree names consistently', () => {
    expect(normalizeDegreeName('BSc (Eng) - Electrical Engineering')).toBe('bsc eng electrical engineering')
    expect(normalizeDegreeName('  Bachelor of Arts & Law  ')).toBe('bachelor of arts and law')
    expect(normalizeDegreeName(null)).toBe('')
  })

  test('contains a broad catalogue of Wits degree templates', () => {
    const templates = getWitsDegreeCourseTemplates()

    expect(templates).toBe(WITS_DEGREE_COURSE_TEMPLATES)
    expect(templates.length).toBeGreaterThanOrEqual(40)

    templates.forEach(function (template) {
      expect(template.degreeName).toEqual(expect.any(String))
      expect(template.faculty).toEqual(expect.any(String))
      expect(template.lastUpdated).toBe('2026-05-17')
      expect(Array.isArray(template.aliases)).toBe(true)
      expect(template.aliases.length).toBeGreaterThan(0)
      expect(Array.isArray(template.sourceUrls)).toBe(true)
      expect(template.sourceUrls.length).toBeGreaterThan(0)
      expect(Array.isArray(template.suggestedCourses)).toBe(true)
      expect(template.suggestedCourses.length).toBeGreaterThanOrEqual(5)
    })
  })

  test('matches electrical engineering to ELEN-heavy autofill data', () => {
    const template = findWitsDegreeCourseTemplate('BSc (Eng) - Electrical Engineering')

    expect(template).toEqual(expect.objectContaining({
      degreeName: 'Electrical Engineering',
      faculty: 'Engineering and the Built Environment'
    }))
    expect(template.coursePrefixes).toContain('ELEN')
    expect(template.suggestedCourses).toEqual(expect.arrayContaining([
      'ELEN Circuit Theory',
      'ELEN Electronics',
      'ELEN Signals and Systems'
    ]))
  })

  test('prefers specific matches before generic faculty-level fallbacks', () => {
    const specificTemplate = findWitsDegreeCourseTemplate('Bachelor of Commerce in Finance')
    const genericTemplate = findWitsDegreeCourseTemplate('Bachelor of Commerce in Unlisted Major')

    expect(specificTemplate.degreeName).toBe('Finance')
    expect(genericTemplate.degreeName).toBe('Bachelor of Commerce')
  })

  test('falls back to umbrella templates when a degree family is known but the field is not modelled', () => {
    const scienceTemplate = findWitsDegreeCourseTemplate('Bachelor of Science in Astrobiology')
    const healthTemplate = findWitsDegreeCourseTemplate('Bachelor of Health Sciences in Global Health')

    expect(scienceTemplate.degreeName).toBe('Bachelor of Science')
    expect(healthTemplate.degreeName).toBe('Bachelor of Health Sciences')
  })

  test('builds an audit report for discovered Wits programme labels', () => {
    const auditReport = buildWitsDegreeTemplateAuditReport([
      'BSc (Eng) - Electrical Engineering',
      'Bachelor of Commerce in Finance',
      'Bachelor of Portal Magic',
      'Bachelor of Commerce in Finance'
    ])

    expect(auditReport.degreeCount).toBe(3)
    expect(auditReport.matchedCount).toBe(2)
    expect(auditReport.unmatchedCount).toBe(1)
    expect(auditReport.matched).toEqual(expect.arrayContaining([
      expect.objectContaining({
        degreeName: 'BSc (Eng) - Electrical Engineering',
        faculty: 'Engineering and the Built Environment',
        templateDegreeName: 'Electrical Engineering'
      }),
      expect.objectContaining({
        degreeName: 'Bachelor of Commerce in Finance',
        faculty: 'Commerce, Law and Management',
        templateDegreeName: 'Finance'
      })
    ]))
    expect(auditReport.unmatched).toEqual(['Bachelor of Portal Magic'])
  })
})
