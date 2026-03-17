var express = require('express');
var router = express.Router();
var db = require('./database');

// Obtener todos los meseros
router.get('/', async function (req, res, next) {
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
});

module.exports = router;
