const DEFAULT_LAST_UPDATED = '2026-05-17'

const SOURCE_URLS = Object.freeze({
  clm: 'https://www.wits.ac.za/clm/undergraduate-programmes/',
  ebe: 'https://www.wits.ac.za/ebe/undergraduate-programmes/',
  health: 'https://www.wits.ac.za/health/academic-programmes/undergraduate-programmes/',
  humanities: 'https://www.wits.ac.za/humanities/undergraduate-programmes/',
  law: 'https://www.wits.ac.za/law/undergraduate-programmes/',
  science: 'https://www.wits.ac.za/science/undergraduate/'
})

const normalizeDegreeName = function (degreeName) {
  if (typeof degreeName !== 'string') {
    return ''
  }

  return degreeName
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const freezeStringArray = function (values) {
  return Object.freeze(
    values
      .filter(function (value) {
        return typeof value === 'string' && value.trim()
      })
      .map(function (value) {
        return value.trim()
      })
  )
}

const escapeRegularExpression = function (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const containsAliasPhrase = function (normalizedDegreeName, alias) {
  const aliasPattern = new RegExp(`(^| )${escapeRegularExpression(alias)}(?= |$)`)

  return aliasPattern.test(normalizedDegreeName)
}

const buildTemplate = function ({
  aliases = [],
  coursePrefixes = [],
  degreeName,
  faculty,
  isFallback = false,
  sourceUrls = [],
  suggestedCourses = []
}) {
  const normalizedDegreeName = normalizeDegreeName(degreeName)
  const normalizedAliases = Array.from(new Set(
    [degreeName, ...aliases]
      .map(normalizeDegreeName)
      .filter(Boolean)
  ))

  return Object.freeze({
    aliases: Object.freeze(normalizedAliases),
    coursePrefixes: freezeStringArray(coursePrefixes),
    degreeName: degreeName.trim(),
    faculty: faculty.trim(),
    isFallback,
    lastUpdated: DEFAULT_LAST_UPDATED,
    normalizedDegreeName,
    sourceUrls: freezeStringArray(sourceUrls),
    suggestedCourses: freezeStringArray(suggestedCourses)
  })
}

const DEGREE_TEMPLATE_DEFINITIONS = [
  {
    degreeName: 'Bachelor of Science in Engineering',
    aliases: [
      'BSc Eng',
      'BSc Engineering',
      'Bachelor of Science in Engineering',
      'Engineering',
      'BSc Engineering part-time',
      'Wits Plus BSc Engineering'
    ],
    coursePrefixes: ['ENG', 'MATH', 'PHYS'],
    faculty: 'Engineering and the Built Environment',
    isFallback: true,
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/wits-plus/bsc-engineering-part-time/'
    ],
    suggestedCourses: [
      'Engineering Mathematics',
      'Engineering Physics',
      'Engineering Computing',
      'Design and Professional Practice',
      'Materials and Mechanics'
    ]
  },
  {
    degreeName: 'Aeronautical Engineering',
    aliases: [
      'BSc Eng Aeronautical Engineering',
      'BSc Engineering Aeronautical Engineering',
      'Aeronautical Engineering'
    ],
    coursePrefixes: ['AERO', 'MECH', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/aeronautical-engineering/'
    ],
    suggestedCourses: [
      'Aerodynamics',
      'Flight Mechanics',
      'Aircraft Structures',
      'Propulsion',
      'Control Systems'
    ]
  },
  {
    degreeName: 'Architectural Studies',
    aliases: [
      'BAS',
      'Architectural Studies',
      'Bachelor of Architectural Studies',
      'Architecture'
    ],
    coursePrefixes: ['ARCH', 'PLAN'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/architectural-studies/'
    ],
    suggestedCourses: [
      'Architectural Design Studio',
      'History of Architecture',
      'Building Construction',
      'Design Communication',
      'Urban Design'
    ]
  },
  {
    degreeName: 'Biomedical Engineering',
    aliases: [
      'BEngSc BME',
      'BEngSc Biomedical Engineering',
      'Biomedical Engineering'
    ],
    coursePrefixes: ['BME', 'ELEN', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/biomedical-engineering/'
    ],
    suggestedCourses: [
      'Biomedical Instrumentation',
      'Signals and Systems',
      'Medical Imaging',
      'Biomechanics',
      'Physiology for Engineers'
    ]
  },
  {
    degreeName: 'Chemical Engineering',
    aliases: [
      'BSc Eng Chemical Engineering',
      'BSc Engineering Chemical Engineering',
      'Chemical Engineering'
    ],
    coursePrefixes: ['CHEM', 'PROC', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/chemical-engineering/'
    ],
    suggestedCourses: [
      'Process Engineering',
      'Thermodynamics',
      'Transport Phenomena',
      'Reaction Engineering',
      'Process Control'
    ]
  },
  {
    degreeName: 'Civil Engineering',
    aliases: [
      'BSc Eng Civil Engineering',
      'BSc Engineering Civil Engineering',
      'Civil Engineering'
    ],
    coursePrefixes: ['CIVL', 'GEOM', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/civil-engineering/'
    ],
    suggestedCourses: [
      'Structural Analysis',
      'Geotechnical Engineering',
      'Hydraulics',
      'Transportation Engineering',
      'Construction Materials'
    ]
  },
  {
    degreeName: 'Construction Studies',
    aliases: [
      'BSc CS',
      'BSc Construction Studies',
      'Construction Studies'
    ],
    coursePrefixes: ['CONS', 'CM'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/construction-studies/'
    ],
    suggestedCourses: [
      'Construction Technology',
      'Building Economics',
      'Project Management',
      'Construction Law',
      'Quantity Surveying Fundamentals'
    ]
  },
  {
    degreeName: 'Bachelor of Engineering Science in Digital Arts',
    aliases: [
      'BEngSc Digital Arts',
      'Engineering Digital Arts',
      'Bachelor of Engineering Science Digital Arts'
    ],
    coursePrefixes: ['DIGA', 'ELEN', 'ARTS'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/digital-arts/'
    ],
    suggestedCourses: [
      'Programming for Games',
      'Interactive Media',
      'Game Design',
      'Digital Animation',
      'Sound Design'
    ]
  },
  {
    degreeName: 'Electrical Engineering',
    aliases: [
      'BSc Eng Electrical Engineering',
      'BSc Engineering Electrical Engineering',
      'Electrical Engineering',
      'Electrical and Information Engineering'
    ],
    coursePrefixes: ['ELEN', 'MATH', 'PHYS'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/electrical-engineering/'
    ],
    suggestedCourses: [
      'ELEN Circuit Theory',
      'ELEN Electronics',
      'ELEN Signals and Systems',
      'ELEN Control Systems',
      'ELEN Power Systems'
    ]
  },
  {
    degreeName: 'Industrial Engineering',
    aliases: [
      'BSc Eng Industrial Engineering',
      'BSc Engineering Industrial Engineering',
      'Industrial Engineering'
    ],
    coursePrefixes: ['IE', 'STAT', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/industrial-engineering/'
    ],
    suggestedCourses: [
      'Operations Research',
      'Production Planning',
      'Quality Engineering',
      'Supply Chain Systems',
      'Systems Simulation'
    ]
  },
  {
    degreeName: 'Information Engineering',
    aliases: [
      'BSc Eng Information Engineering',
      'BSc Engineering Information Engineering',
      'Information Engineering'
    ],
    coursePrefixes: ['ELEN', 'INFO', 'NETW'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/information-engineering/'
    ],
    suggestedCourses: [
      'Digital Systems',
      'Computer Networking',
      'Software Engineering',
      'Telecommunications',
      'Embedded Systems'
    ]
  },
  {
    degreeName: 'Mechanical Engineering',
    aliases: [
      'BSc Eng Mechanical Engineering',
      'BSc Engineering Mechanical Engineering',
      'Mechanical Engineering'
    ],
    coursePrefixes: ['MECH', 'MATS', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/mechanical-engineering/'
    ],
    suggestedCourses: [
      'Thermodynamics',
      'Fluid Mechanics',
      'Mechanics of Machines',
      'Heat Transfer',
      'Manufacturing Engineering'
    ]
  },
  {
    degreeName: 'Metallurgy and Materials Engineering',
    aliases: [
      'BSc Eng Metallurgy and Materials Engineering',
      'BSc Engineering Metallurgy and Materials Engineering',
      'Metallurgy and Materials Engineering',
      'Materials Engineering'
    ],
    coursePrefixes: ['METE', 'MATS', 'CHEM'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/metallurgy-and-materials-engineering/'
    ],
    suggestedCourses: [
      'Extractive Metallurgy',
      'Materials Science',
      'Thermodynamics',
      'Mineral Processing',
      'Corrosion and Failure'
    ]
  },
  {
    degreeName: 'Mining Engineering',
    aliases: [
      'BSc Eng Mining Engineering',
      'BSc Engineering Mining Engineering',
      'Mining Engineering'
    ],
    coursePrefixes: ['MINE', 'GEOL', 'MATH'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/mining-engineering/'
    ],
    suggestedCourses: [
      'Mine Surveying',
      'Rock Engineering',
      'Mineral Economics',
      'Ventilation',
      'Mine Design'
    ]
  },
  {
    degreeName: 'Property Studies',
    aliases: [
      'BSc PS',
      'BSc Property Studies',
      'Property Studies'
    ],
    coursePrefixes: ['PROP', 'ECON', 'PLAN'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/property-studies/'
    ],
    suggestedCourses: [
      'Property Finance',
      'Property Valuation',
      'Real Estate Economics',
      'Property Investment',
      'Urban Economics'
    ]
  },
  {
    degreeName: 'Urban and Regional Planning',
    aliases: [
      'BSc URP',
      'BSc Urban and Regional Planning',
      'Urban and Regional Planning',
      'Urban Planning'
    ],
    coursePrefixes: ['PLAN', 'GEOG', 'GIS'],
    faculty: 'Engineering and the Built Environment',
    sourceUrls: [
      SOURCE_URLS.ebe,
      'https://www.wits.ac.za/course-finder/undergraduate/ebe/urban-and-regional-planning/'
    ],
    suggestedCourses: [
      'Planning Theory',
      'Urban Design',
      'GIS for Planning',
      'Housing Policy',
      'Transport Planning'
    ]
  },

  {
    degreeName: 'Bachelor of Science',
    aliases: [
      'BSc',
      'Bachelor of Science',
      'Science Degree'
    ],
    coursePrefixes: ['MATH', 'STAT', 'PHYS', 'CHEM', 'BIOS'],
    faculty: 'Science',
    isFallback: true,
    sourceUrls: [SOURCE_URLS.science],
    suggestedCourses: [
      'Mathematics I',
      'Scientific Computing',
      'Physics I',
      'Chemistry I',
      'Biological Sciences I'
    ]
  },
  {
    degreeName: 'Actuarial Science',
    aliases: [
      'BSc Actuarial Science',
      'Bachelor of Science Actuarial Science',
      'Actuarial Science'
    ],
    coursePrefixes: ['ACTL', 'STAT', 'MATH'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/course-finder/undergraduate/science/actuarial-science/'
    ],
    suggestedCourses: [
      'Actuarial Science I',
      'Mathematical Statistics I',
      'Business Accounting I',
      'Life Contingencies',
      'Actuarial Reserving Techniques'
    ]
  },
  {
    degreeName: 'Biological Sciences',
    aliases: [
      'BSc Biological Sciences',
      'Biological Sciences',
      'Life Sciences',
      'Biology'
    ],
    coursePrefixes: ['BIOL', 'MCB', 'GENE'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/science/undergraduate/biological-sciences-programme/'
    ],
    suggestedCourses: [
      'Cell Biology',
      'Genetics',
      'Ecology',
      'Biochemistry',
      'Microbiology'
    ]
  },
  {
    degreeName: 'Chemistry',
    aliases: [
      'BSc Chemistry',
      'Chemistry',
      'Physical Science Chemistry'
    ],
    coursePrefixes: ['CHEM', 'MATH', 'PHYS'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/course-finder/undergraduate/science/chemistry/'
    ],
    suggestedCourses: [
      'Chemistry I',
      'Analytical Chemistry',
      'Organic Chemistry',
      'Inorganic Chemistry',
      'Physical Chemistry'
    ]
  },
  {
    degreeName: 'Computer Science',
    aliases: [
      'BSc Computer Science',
      'Computer Science',
      'Computational Applications'
    ],
    coursePrefixes: ['COMS', 'MATH', 'STAT'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/course-finder/undergraduate/science/computer-science/'
    ],
    suggestedCourses: [
      'Basic Computer Organisation',
      'Introduction to Algorithms and Programming',
      'Introduction to Data Structures and Algorithms',
      'Database Fundamentals',
      'Computer Networks'
    ]
  },
  {
    degreeName: 'Environmental Sciences',
    aliases: [
      'BSc Environmental Sciences',
      'Environmental Sciences',
      'Environmental Science'
    ],
    coursePrefixes: ['ENVS', 'GEOG', 'BIOL'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/science/undergraduate/earth-sciences/'
    ],
    suggestedCourses: [
      'Environmental Systems',
      'Ecology',
      'GIS',
      'Climate Change Studies',
      'Conservation Biology'
    ]
  },
  {
    degreeName: 'Geosciences',
    aliases: [
      'BSc Geosciences',
      'Geosciences',
      'Earth Sciences',
      'Geology',
      'Archaeology and Geography'
    ],
    coursePrefixes: ['GEOL', 'GEOG', 'GIS'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/science/undergraduate/earth-sciences/'
    ],
    suggestedCourses: [
      'Physical Geology',
      'Mineralogy',
      'Geomorphology',
      'GIS for Earth Sciences',
      'Environmental Geoscience'
    ]
  },
  {
    degreeName: 'Mathematics',
    aliases: [
      'BSc Mathematics',
      'Mathematics',
      'Mathematical Sciences'
    ],
    coursePrefixes: ['MATH', 'STAT'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/science/undergraduate/mathematical-sciences/'
    ],
    suggestedCourses: [
      'Algebra I',
      'Calculus I',
      'Linear Algebra',
      'Differential Equations',
      'Abstract Mathematics'
    ]
  },
  {
    degreeName: 'Physics',
    aliases: [
      'BSc Physics',
      'Physics',
      'Physical Science Physics',
      'Astronomy',
      'Astrophysics'
    ],
    coursePrefixes: ['PHYS', 'MATH'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/course-finder/undergraduate/science/physics/'
    ],
    suggestedCourses: [
      'Physics I',
      'Quantum Mechanics',
      'Waves and Modern Optics',
      'Statistical Physics',
      'Advanced Experimental Physics'
    ]
  },
  {
    degreeName: 'Statistical Science',
    aliases: [
      'BSc Statistics',
      'Statistics',
      'Statistical Science',
      'Mathematical Statistics'
    ],
    coursePrefixes: ['STAT', 'MATH'],
    faculty: 'Science',
    sourceUrls: [
      SOURCE_URLS.science,
      'https://www.wits.ac.za/science/undergraduate/mathematical-sciences/'
    ],
    suggestedCourses: [
      'Probability Theory',
      'Mathematical Statistics',
      'Regression Analysis',
      'Stochastic Processes',
      'Data Analysis'
    ]
  },

  {
    degreeName: 'Bachelor of Commerce',
    aliases: [
      'BCom',
      'Bachelor of Commerce',
      'BCom General',
      'Commerce',
      'BCom part-time'
    ],
    coursePrefixes: ['ACCN', 'ECON', 'BUSN'],
    faculty: 'Commerce, Law and Management',
    isFallback: true,
    sourceUrls: [SOURCE_URLS.clm],
    suggestedCourses: [
      'Financial Accounting',
      'Economics',
      'Business Statistics',
      'Management',
      'Commercial Law'
    ]
  },
  {
    degreeName: 'Accounting',
    aliases: [
      'BCom Accounting',
      'Accounting'
    ],
    coursePrefixes: ['ACCN', 'AUDT', 'TAX'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/accounting/'
    ],
    suggestedCourses: [
      'Financial Accounting',
      'Management Accounting',
      'Auditing',
      'Taxation',
      'Commercial Law'
    ]
  },
  {
    degreeName: 'Accounting Science',
    aliases: [
      'BAccSc',
      'Accounting Science',
      'Bachelor of Accounting Science'
    ],
    coursePrefixes: ['ACCN', 'AUDT', 'TAX'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/accounting-science-baccsc/'
    ],
    suggestedCourses: [
      'Financial Accounting',
      'Management Accounting and Finance',
      'Auditing',
      'Taxation',
      'Corporate Governance'
    ]
  },
  {
    degreeName: 'Applied Development Economics',
    aliases: [
      'BCom Applied Development Economics',
      'Applied Development Economics'
    ],
    coursePrefixes: ['ECON', 'DEVP', 'STAT'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/applied-development-economics/'
    ],
    suggestedCourses: [
      'Microeconomics',
      'Macroeconomics',
      'Development Economics',
      'Econometrics',
      'Public Policy'
    ]
  },
  {
    degreeName: 'Economic Science',
    aliases: [
      'BEconSc',
      'Economic Science',
      'Bachelor of Economic Science'
    ],
    coursePrefixes: ['ECON', 'MATH', 'STAT'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/economic-science/'
    ],
    suggestedCourses: [
      'Mathematical Economics',
      'Microeconomic Theory',
      'Macroeconomic Theory',
      'Econometrics',
      'Statistical Methods'
    ]
  },
  {
    degreeName: 'Economics',
    aliases: [
      'BCom Economics',
      'Economics'
    ],
    coursePrefixes: ['ECON', 'STAT'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/economics/'
    ],
    suggestedCourses: [
      'Microeconomics',
      'Macroeconomics',
      'Econometrics',
      'Public Economics',
      'International Trade'
    ]
  },
  {
    degreeName: 'Financial Sciences',
    aliases: [
      'BCom Financial Sciences',
      'Financial Sciences'
    ],
    coursePrefixes: ['FINA', 'ECON', 'DATA'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/bcom-financial-sciences/'
    ],
    suggestedCourses: [
      'Corporate Finance',
      'Investments',
      'Financial Modelling',
      'Fintech',
      'Economics'
    ]
  },
  {
    degreeName: 'Finance',
    aliases: [
      'BCom Finance',
      'Finance'
    ],
    coursePrefixes: ['FINA', 'ECON', 'RISK'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/finance/'
    ],
    suggestedCourses: [
      'Corporate Finance',
      'Financial Markets',
      'Investments',
      'Portfolio Theory',
      'Risk Management'
    ]
  },
  {
    degreeName: 'Human Resource Management',
    aliases: [
      'BCom Human Resource Management',
      'Human Resource Management',
      'HRM'
    ],
    coursePrefixes: ['HRM', 'PSYC', 'MGMT'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/human-resource-management/'
    ],
    suggestedCourses: [
      'Organisational Behaviour',
      'Labour Relations',
      'Talent Management',
      'Compensation Management',
      'People Analytics'
    ]
  },
  {
    degreeName: 'Insurance and Risk Management',
    aliases: [
      'BCom Insurance and Risk Management',
      'Insurance and Risk Management',
      'Risk Management'
    ],
    coursePrefixes: ['RISK', 'STAT', 'ACTL'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/insurance-and-risk-management/'
    ],
    suggestedCourses: [
      'Risk Management',
      'Insurance Principles',
      'Probability Models',
      'Loss Modelling',
      'Enterprise Risk'
    ]
  },
  {
    degreeName: 'Information Systems',
    aliases: [
      'BCom Information Systems',
      'Information Systems'
    ],
    coursePrefixes: ['INFO', 'DATA', 'BUSN'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/information-systems/'
    ],
    suggestedCourses: [
      'Systems Analysis',
      'Database Design',
      'Business Process Modelling',
      'Programming Fundamentals',
      'IT Governance'
    ]
  },
  {
    degreeName: 'Management',
    aliases: [
      'BCom Management',
      'Management'
    ],
    coursePrefixes: ['MGMT', 'BUSN'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/management/'
    ],
    suggestedCourses: [
      'Strategy',
      'Operations Management',
      'Entrepreneurship',
      'Project Management',
      'Organisational Behaviour'
    ]
  },
  {
    degreeName: 'Marketing',
    aliases: [
      'BCom Marketing',
      'Marketing'
    ],
    coursePrefixes: ['MKTG', 'BUSN', 'DATA'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/marketing/'
    ],
    suggestedCourses: [
      'Consumer Behaviour',
      'Brand Management',
      'Market Research',
      'Digital Marketing',
      'Sales Management'
    ]
  },
  {
    degreeName: 'Politics, Philosophy and Economics',
    aliases: [
      'BCom PPE',
      'Politics Philosophy and Economics',
      'PPE'
    ],
    coursePrefixes: ['PPE', 'ECON', 'PHIL', 'POLS'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/ppe/'
    ],
    suggestedCourses: [
      'Political Theory',
      'Microeconomics',
      'Ethics',
      'Public Policy',
      'Macroeconomics'
    ]
  },
  {
    degreeName: 'Bachelor of Commerce with Law',
    aliases: [
      'BCom with Law',
      'BCom part-time with Law',
      'Commerce with Law'
    ],
    coursePrefixes: ['LAW', 'ECON', 'ACCN'],
    faculty: 'Commerce, Law and Management',
    sourceUrls: [
      SOURCE_URLS.clm,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/law/'
    ],
    suggestedCourses: [
      'Commercial Law',
      'Economics',
      'Financial Accounting',
      'Contract',
      'Corporate Governance'
    ]
  },
  {
    degreeName: 'Bachelor of Laws',
    aliases: [
      'LLB',
      'Bachelor of Laws',
      'Law'
    ],
    coursePrefixes: ['LAW'],
    faculty: 'Law',
    sourceUrls: [
      SOURCE_URLS.law,
      'https://www.wits.ac.za/course-finder/undergraduate/clm/llb-law/'
    ],
    suggestedCourses: [
      'Constitutional Law',
      'Contract',
      'Criminal Law',
      'Jurisprudence',
      'Civil Procedure'
    ]
  },

  {
    degreeName: 'Bachelor of Arts',
    aliases: [
      'BA',
      'Bachelor of Arts',
      'BA part-time',
      'Humanities'
    ],
    coursePrefixes: ['HUMA', 'SOCI', 'POLS', 'PSYC'],
    faculty: 'Humanities',
    isFallback: true,
    sourceUrls: [SOURCE_URLS.humanities],
    suggestedCourses: [
      'Psychology I',
      'Sociology I',
      'Political Studies I',
      'History I',
      'Media Studies I'
    ]
  },
  {
    degreeName: 'Bachelor of Arts in Digital Arts',
    aliases: [
      'BA Digital Arts',
      'Humanities Digital Arts'
    ],
    coursePrefixes: ['DIGA', 'ARTS', 'COMP'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/digital-arts/'
    ],
    suggestedCourses: [
      'Game Design',
      'Animation',
      'Interactive Narrative',
      'Programming for Digital Arts',
      'Sound Design'
    ]
  },
  {
    degreeName: 'Film and Television',
    aliases: [
      'BAFT',
      'Film and Television',
      'Film Studies',
      'Television Studies'
    ],
    coursePrefixes: ['FILM', 'TV'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/film-and-television/'
    ],
    suggestedCourses: [
      'Screenwriting',
      'Directing',
      'Editing',
      'Production Studies',
      'Documentary Practice'
    ]
  },
  {
    degreeName: 'Fine Arts',
    aliases: [
      'BAFA',
      'Fine Arts'
    ],
    coursePrefixes: ['ARTS', 'VISA'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/fine-arts/'
    ],
    suggestedCourses: [
      'Studio Practice',
      'Drawing',
      'Art History',
      'Visual Culture',
      'Critical Theory'
    ]
  },
  {
    degreeName: 'Bachelor of Education',
    aliases: [
      'BEd',
      'Bachelor of Education',
      'Foundation Phase Teaching',
      'Intermediate Phase Teaching',
      'Senior Phase Teaching',
      'Further Education and Training Teaching'
    ],
    coursePrefixes: ['EDUC', 'PSYC', 'CURR'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/bed-foundation-phase-teaching/',
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/bed-intermediate-phase-teaching/',
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/bed-senior-phase-teaching/'
    ],
    suggestedCourses: [
      'Curriculum Studies',
      'Educational Psychology',
      'Teaching Practice',
      'Assessment in Education',
      'Inclusive Education'
    ]
  },
  {
    degreeName: 'Music',
    aliases: [
      'BMus',
      'Music'
    ],
    coursePrefixes: ['MUSI', 'PERF'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/music/'
    ],
    suggestedCourses: [
      'Music Theory',
      'Aural Training',
      'Performance',
      'Composition',
      'Musicology'
    ]
  },
  {
    degreeName: 'Social Work',
    aliases: [
      'Bachelor of Social Work',
      'Social Work'
    ],
    coursePrefixes: ['SOWK', 'SOCI'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/social-work/'
    ],
    suggestedCourses: [
      'Social Policy',
      'Counselling Skills',
      'Community Development',
      'Human Behaviour',
      'Fieldwork Practice'
    ]
  },
  {
    degreeName: 'Speech-Language Pathology',
    aliases: [
      'B Speech',
      'Speech-Language Pathology',
      'Speech Language Pathology'
    ],
    coursePrefixes: ['SLP', 'LING', 'PSYC'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/speech-language-pathology/'
    ],
    suggestedCourses: [
      'Phonetics',
      'Language Development',
      'Speech Disorders',
      'Clinical Practice',
      'Neurolinguistics'
    ]
  },
  {
    degreeName: 'Audiology',
    aliases: [
      'B Audiology',
      'Audiology'
    ],
    coursePrefixes: ['AUDI', 'LING'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/audiology/'
    ],
    suggestedCourses: [
      'Anatomy of Hearing',
      'Audiometry',
      'Hearing Science',
      'Diagnostic Audiology',
      'Aural Rehabilitation'
    ]
  },
  {
    degreeName: 'Theatre and Performance',
    aliases: [
      'BA Theatre and Performance',
      'Theatre and Performance'
    ],
    coursePrefixes: ['DRAM', 'PERF'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/theatre-and-performance/'
    ],
    suggestedCourses: [
      'Acting',
      'Directing',
      'Performance Studies',
      'Stagecraft',
      'Dramatic Literature'
    ]
  },
  {
    degreeName: 'Bachelor of Arts with Law',
    aliases: [
      'BA with Law',
      'BA part-time with Law'
    ],
    coursePrefixes: ['LAW', 'POLS', 'PHIL'],
    faculty: 'Humanities',
    sourceUrls: [
      SOURCE_URLS.humanities,
      'https://www.wits.ac.za/course-finder/undergraduate/humanities/law/'
    ],
    suggestedCourses: [
      'Introduction to Law',
      'Legal Writing',
      'Political Studies',
      'Philosophy',
      'Sociology'
    ]
  },

  {
    degreeName: 'Bachelor of Health Sciences',
    aliases: [
      'BHSc',
      'Bachelor of Health Sciences',
      'Health Sciences'
    ],
    coursePrefixes: ['HEAL', 'BIOM', 'STAT'],
    faculty: 'Health Sciences',
    isFallback: true,
    sourceUrls: [SOURCE_URLS.health],
    suggestedCourses: [
      'Human Biology',
      'Health Systems',
      'Biostatistics',
      'Public Health',
      'Research Methods'
    ]
  },
  {
    degreeName: 'Biokinetics',
    aliases: [
      'BHSc Biokinetics',
      'Biokinetics'
    ],
    coursePrefixes: ['BIOK', 'ANAT', 'PHYSIO'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/biokinetics/'
    ],
    suggestedCourses: [
      'Exercise Physiology',
      'Biomechanics',
      'Health Promotion',
      'Rehabilitation Practice',
      'Functional Anatomy'
    ]
  },
  {
    degreeName: 'Biomedical Sciences',
    aliases: [
      'BHSc Biomedical Sciences',
      'Biomedical Sciences'
    ],
    coursePrefixes: ['BIOM', 'ANAT', 'PHSL'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/biomedical-sciences/'
    ],
    suggestedCourses: [
      'Cell Biology',
      'Anatomy',
      'Physiology',
      'Pathology',
      'Biochemistry'
    ]
  },
  {
    degreeName: 'Clinical Medical Practice',
    aliases: [
      'BCMP',
      'Clinical Medical Practice'
    ],
    coursePrefixes: ['CLMP', 'MED'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/clinical-medical-practice/'
    ],
    suggestedCourses: [
      'Clinical Skills',
      'Primary Care',
      'Emergency Care',
      'Diagnostics',
      'Community Health'
    ]
  },
  {
    degreeName: 'Dental Science',
    aliases: [
      'BDS',
      'Dental Science',
      'Dentistry'
    ],
    coursePrefixes: ['DENT', 'ORAL'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/dental-science/'
    ],
    suggestedCourses: [
      'Oral Biology',
      'Dental Anatomy',
      'Restorative Dentistry',
      'Periodontology',
      'Community Dentistry'
    ]
  },
  {
    degreeName: 'Health Systems Science',
    aliases: [
      'BHSc Health Systems Science',
      'Health Systems Science',
      'Public Health'
    ],
    coursePrefixes: ['HSSC', 'PUBH', 'STAT'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/health-systems-science/'
    ],
    suggestedCourses: [
      'Epidemiology',
      'Health Policy',
      'Health Economics',
      'Biostatistics',
      'Community Health'
    ]
  },
  {
    degreeName: 'Medicine and Surgery',
    aliases: [
      'MBBCh',
      'Medicine and Surgery',
      'Medicine'
    ],
    coursePrefixes: ['MEDI', 'SURG', 'ANAT'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/medicine-and-surgery/'
    ],
    suggestedCourses: [
      'Anatomy',
      'Physiology',
      'Pharmacology',
      'Internal Medicine',
      'Surgery'
    ]
  },
  {
    degreeName: 'Nursing',
    aliases: [
      'BNurs',
      'Bachelor of Nursing',
      'Nursing'
    ],
    coursePrefixes: ['NURS', 'MIDW'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/nursing/'
    ],
    suggestedCourses: [
      'General Nursing',
      'Midwifery',
      'Community Nursing',
      'Clinical Practice',
      'Health Assessment'
    ]
  },
  {
    degreeName: 'Nursing Systems Science',
    aliases: [
      'BHSc Nursing Systems Science',
      'Nursing Systems Science'
    ],
    coursePrefixes: ['NURS', 'HSSC', 'LEAD'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/nursing-systems-science/'
    ],
    suggestedCourses: [
      'Health Leadership',
      'Evidence-Based Practice',
      'Health Systems',
      'Research Methods',
      'Professional Practice'
    ]
  },
  {
    degreeName: 'Occupational Therapy',
    aliases: [
      'BSc Occupational Therapy',
      'BSc OT',
      'Occupational Therapy'
    ],
    coursePrefixes: ['OT', 'REHB'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/occupational-therapy/'
    ],
    suggestedCourses: [
      'Occupational Performance',
      'Therapeutic Activities',
      'Rehabilitation',
      'Mental Health Practice',
      'Community Practice'
    ]
  },
  {
    degreeName: 'Oral Health Sciences',
    aliases: [
      'BOHSc',
      'Oral Health Sciences'
    ],
    coursePrefixes: ['ORAL', 'DENT'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/oral-health-sciences/'
    ],
    suggestedCourses: [
      'Preventive Dentistry',
      'Oral Anatomy',
      'Periodontal Care',
      'Dental Radiography',
      'Community Oral Health'
    ]
  },
  {
    degreeName: 'Pharmacy',
    aliases: [
      'BPharm',
      'Pharmacy'
    ],
    coursePrefixes: ['PHRM', 'CHEM', 'MEDI'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/pharmacy/'
    ],
    suggestedCourses: [
      'Pharmaceutics',
      'Pharmacology',
      'Medicinal Chemistry',
      'Clinical Pharmacy',
      'Pharmacy Practice'
    ]
  },
  {
    degreeName: 'Physiotherapy',
    aliases: [
      'BSc Physiotherapy',
      'Physiotherapy'
    ],
    coursePrefixes: ['PHYSIO', 'ANAT', 'REHB'],
    faculty: 'Health Sciences',
    sourceUrls: [
      SOURCE_URLS.health,
      'https://www.wits.ac.za/course-finder/undergraduate/health/physiotherapy/'
    ],
    suggestedCourses: [
      'Musculoskeletal Therapy',
      'Neurological Rehabilitation',
      'Cardiopulmonary Therapy',
      'Exercise Therapy',
      'Clinical Practice'
    ]
  }
]

const WITS_DEGREE_COURSE_TEMPLATES = Object.freeze(DEGREE_TEMPLATE_DEFINITIONS.map(buildTemplate))

const WITS_DEGREE_ALIAS_MAP = WITS_DEGREE_COURSE_TEMPLATES.reduce(function (aliasMap, template) {
  template.aliases.forEach(function (alias) {
    if (aliasMap.has(alias)) {
      throw new Error(`Duplicate degree alias found: ${alias}`)
    }

    aliasMap.set(alias, template)
  })

  return aliasMap
}, new Map())

const getWitsDegreeCourseTemplates = function () {
  return WITS_DEGREE_COURSE_TEMPLATES
}

const buildWitsDegreeTemplateAuditReport = function (degreeNames) {
  const discoveredDegreeNames = Array.from(new Set(
    (Array.isArray(degreeNames) ? degreeNames : [])
      .filter(function (degreeName) {
        return typeof degreeName === 'string' && degreeName.trim()
      })
      .map(function (degreeName) {
        return degreeName.trim()
      })
  ))

  const matched = []
  const unmatched = []

  discoveredDegreeNames.forEach(function (degreeName) {
    const template = findWitsDegreeCourseTemplate(degreeName)

    if (!template) {
      unmatched.push(degreeName)
      return
    }

    matched.push({
      degreeName,
      faculty: template.faculty,
      templateDegreeName: template.degreeName
    })
  })

  return {
    degreeCount: discoveredDegreeNames.length,
    matched,
    matchedCount: matched.length,
    templateCount: WITS_DEGREE_COURSE_TEMPLATES.length,
    unmatched,
    unmatchedCount: unmatched.length
  }
}

const findWitsDegreeCourseTemplate = function (degreeName) {
  const normalizedDegreeName = normalizeDegreeName(degreeName)

  if (!normalizedDegreeName) {
    return null
  }

  const exactMatch = WITS_DEGREE_ALIAS_MAP.get(normalizedDegreeName)

  if (exactMatch) {
    return exactMatch
  }

  let bestMatch = null
  let bestScore = 0

  WITS_DEGREE_COURSE_TEMPLATES.forEach(function (template) {
    if (template.isFallback) {
      return
    }

    template.aliases.forEach(function (alias) {
      if (!containsAliasPhrase(normalizedDegreeName, alias) || alias.length <= bestScore) {
        return
      }

      bestMatch = template
      bestScore = alias.length
    })
  })

  if (bestMatch) {
    return bestMatch
  }

  WITS_DEGREE_COURSE_TEMPLATES.forEach(function (template) {
    if (!template.isFallback) {
      return
    }

    template.aliases.forEach(function (alias) {
      if (!containsAliasPhrase(normalizedDegreeName, alias) || alias.length <= bestScore) {
        return
      }

      bestMatch = template
      bestScore = alias.length
    })
  })

  return bestMatch
}

module.exports = {
  buildWitsDegreeTemplateAuditReport,
  findWitsDegreeCourseTemplate,
  getWitsDegreeCourseTemplates,
  normalizeDegreeName,
  SOURCE_URLS,
  WITS_DEGREE_COURSE_TEMPLATES
}
