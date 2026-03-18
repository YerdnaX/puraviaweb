var express = require('express')
var router = express.Router()
var db = require('./database')
var sql = db.sql

// Render admin dashboard
router.get('/', function (req, res, next) {
  res.render('mesas')
})

router.get('/gestion-orden', async function (req, res, next) {
  const mesaNumero = parseInt(req.query.mesa || req.params.mesa, 10)
  if (!mesaNumero) {
    return res.render('gestion-orden', { mesa: null, mensaje: 'Mesa no especificada' })
  }

  try {
    const pool = await db.poolPromise

    const mesaRs = await pool.request()
      .input('numero', sql.Int, mesaNumero)
      .query('SELECT id, numero, estado, capacidad FROM mesa WHERE numero = @numero')

    if (!mesaRs.recordset.length) {
      return res.render('gestion-orden', { mesa: mesaNumero, mensaje: 'Mesa no encontrada' })
    }

    const mesaId = mesaRs.recordset[0].id

    // Si no hay orden abierta, crear una
    let ordenRs = await pool.request()
      .input('mesaId', sql.Int, mesaId)
      .query(`SELECT TOP 1 id, mesero_id, estado, total, creada_en
              FROM orden
              WHERE mesa_id = @mesaId AND estado = 'abierta'
              ORDER BY creada_en DESC`)

    if (!ordenRs.recordset.length) {
      // elegir un mesero disponible (el primero)
      const meseroRs = await pool.request()
        .query('SELECT TOP 1 id FROM mesero ORDER BY id')
      if (!meseroRs.recordset.length) {
        return res.render('gestion-orden', { mesa: mesaNumero, mensaje: 'No hay meseros configurados para abrir la orden' })
      }
      const meseroId = meseroRs.recordset[0].id

      await pool.request()
        .input('mesaId', sql.Int, mesaId)
        .input('meseroId', sql.Int, meseroId)
        .query(`INSERT INTO orden (mesa_id, mesero_id, estado, total) VALUES (@mesaId, @meseroId, 'abierta', 0)`)

      // marcar mesa ocupada
      await pool.request()
        .input('mesaId', sql.Int, mesaId)
        .query(`UPDATE mesa SET estado = 'ocupada' WHERE id = @mesaId`)

      ordenRs = await pool.request()
        .input('mesaId', sql.Int, mesaId)
        .query(`SELECT TOP 1 id, mesero_id, estado, total, creada_en
                FROM orden
                WHERE mesa_id = @mesaId AND estado = 'abierta'
                ORDER BY creada_en DESC`)
    }

    let detalles = []
    let subtotal = 0
    let impuesto = 0
    let total = 0
    let orden = null

    if (ordenRs.recordset.length) {
      orden = ordenRs.recordset[0]

      const detRs = await pool.request()
        .input('ordenId', sql.Int, orden.id)
        .query(`SELECT od.id, p.nombre, od.cantidad, od.precio_unit, od.subtotal, od.observaciones
                FROM orden_detalle od
                JOIN producto p ON od.producto_id = p.id
                WHERE od.orden_id = @ordenId`)

      detalles = detRs.recordset

      const totRs = await pool.request()
        .input('ordenId', sql.Int, orden.id)
        .query(`SELECT SUM(subtotal) AS subtotal FROM orden_detalle WHERE orden_id = @ordenId`)

      subtotal = Number(totRs.recordset[0].subtotal || 0)
      impuesto = Number((subtotal * 0.13).toFixed(2))
      total = Number((subtotal + impuesto).toFixed(2))
    }

    // productos para el combo
    const productosRs = await pool.request()
      .query(`SELECT id, nombre, precio FROM producto WHERE activo = 1 ORDER BY nombre`)

    res.render('gestion-orden', {
      mesa: mesaNumero,
      orden,
      detalles,
      subtotal,
      impuesto,
      total,
      mensaje: orden ? null : 'La mesa no tiene orden activa',
      productos: productosRs.recordset
    })
  } catch (err) {
    next(err)
  }
})

router.get('/reservar-mesa', async function (req, res, next) {
  const mesaNumero = parseInt(req.query.mesa || req.params.mesa, 10)
  try {
    const pool = await db.poolPromise

    if (mesaNumero) {
      const mesaSel = await pool.request()
        .input('numero', sql.Int, mesaNumero)
        .query('SELECT id, numero, capacidad, estado FROM mesa WHERE numero = @numero')

      if (!mesaSel.recordset.length) {
        return res.render('reservar-mesa', { mesas: [], mensaje: 'Mesa no encontrada' })
      }

      return res.render('reservar-mesa', { mesaSeleccionada: mesaSel.recordset[0], mesas: [] })
    }

    const mesasRs = await pool.request().query('SELECT id, numero, capacidad, estado FROM mesa ORDER BY numero')
    res.render('reservar-mesa', { mesas: mesasRs.recordset })
  } catch (err) {
    next(err)
  }
})


module.exports = router
