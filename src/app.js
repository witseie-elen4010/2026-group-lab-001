const path = require('path')
const express = require('express')
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')

const app = express()
const port = process.env.PORT || 8080

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public'))) // css style template
app.use('/login', loginRouter)
app.use('/register', registerRouter)

// entry-point is login page. This can be changed when authentication between pages is added
app.get('/', (req, res) => {
  res.redirect('/login')
})

// does nothing atm
app.get('/home', (req, res) => {
  res.render('home', {
    title: 'Home'
  })
})

if (require.main === module) {
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
  })
}

module.exports = app
