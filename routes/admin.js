var express = require('express')
var router = express.Router()
var db = require('./database')

// Render admin dashboard
router.get('/', function (req, res, next) {
  res.render('admin')
})

router.get('/admin-meseros', async function (req, res, next) {
    try {
        const pool = await db.poolPromise;
        const result = await pool
          .request()
          .query(
            `SELECT id, nombre, identificacion, telefono, correo, turno, usuario_id, observaciones
             FROM mesero
             ORDER BY nombre`
          );
    
        res.render('admin-meseros', { meseros: result.recordset });
      } catch (err) {
        next(err);
      }
})

router.get('/admin-usuarios', function (req, res, next) {
  res.render('admin-usuarios')
})


module.exports = router
