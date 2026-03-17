var express = require('express')
var router = express.Router()

// Render admin dashboard
router.get('/', function (req, res, next) {
  res.render('mesas')
})

router.get('/gestion-orden', function (req, res, next) {
  res.render('gestion-orden')
})

router.get('/reservar-mesa', function (req, res, next) {
  res.render('reservar-mesa')
})


module.exports = router