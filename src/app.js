const path = require('path')
const express = require('express')
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')

const APP = express()
const PORT = process.env.PORT || 8080

APP.set('view engine', 'ejs')
APP.set('views', path.join(__dirname, 'views'))

APP.use(express.urlencoded({ extended: true }))
APP.use(express.static(path.join(__dirname, 'public'))) // css style template
APP.use('/login', loginRouter)
APP.use('/register', registerRouter)

// entry-point is login page. This can be changed when authentication between pages is added
APP.get('/', (req, res) => {
  res.redirect('/login')
})

// does nothing atm
APP.get('/home', (req, res) => {
  res.render('home', {
    title: 'Home'
  })
})

if (require.main === module) {
  APP.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
  })
}

module.exports = APP
