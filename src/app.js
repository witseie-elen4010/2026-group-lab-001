const path = require('path')
const express = require('express')
const session = require('express-session')
const requireAuthentication = require('./middleware/require_authentication')
const institutionSearchRouter = require('./routes/institution_search')
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')
const homeRouter = require('./routes/home')
const lecturerRouter = require('./routes/lecturer')
const scheduleConsultationRouter = require('./routes/schedule_consultation')
const scheduledConsultationsRouter = require('./routes/scheduled_consultations')
const userProfileRouter = require('./routes/user_profile')
const app = express()
const PORT = process.env.PORT || 8080
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret'

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public'))) // css style template
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: SESSION_SECRET
}))
app.use('/institutions', institutionSearchRouter)
app.use('/login', loginRouter)
app.use('/register', registerRouter)
app.use('/home', requireAuthentication, homeRouter)
app.use('/lecturer', requireAuthentication, lecturerRouter)
app.use('/schedule_consultation', requireAuthentication, scheduleConsultationRouter)
app.use('/scheduled_consultations', requireAuthentication, scheduledConsultationsRouter)
app.use('/user_profile', requireAuthentication, userProfileRouter)
// entry-point is login page. This can be changed when authentication between pages is added

app.get('/', (req, res) => {
  res.redirect('/login')
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
  })
}

module.exports = app
