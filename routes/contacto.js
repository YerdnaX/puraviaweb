var express = require('express')
var router = express.Router()

// Render admin dashboard
router.get('/', function (req, res, next) {
  res.render('contacto')
})


module.exports = router