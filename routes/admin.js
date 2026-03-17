var express = require('express')
var router = express.Router()

// Render admin dashboard
router.get('/', function (req, res, next) {
  res.render('admin')
})

router.get('/admin-meseros', function (req, res, next) {
  res.render('admin-meseros')
})

router.get('/admin-usuarios', function (req, res, next) {
  res.render('admin-usuarios')
})


module.exports = router
