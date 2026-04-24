const path = require('path')
const express = require('express')
const institutionSearchRouter = require('./routes/institution_search')
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')
const homeRouter = require('./routes/home')
const lecturerRouter = require('./routes/lecturer')
const userProfileRouter = require('./routes/user_profile')
const app = express()
const PORT = process.env.PORT || 8080

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public'))) // css style template
app.use('/institutions', institutionSearchRouter)
app.use('/login', loginRouter)
app.use('/register', registerRouter)
app.use('/home', homeRouter)
app.use('/lecturer', lecturerRouter)
app.use('/user_profile', userProfileRouter)
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
