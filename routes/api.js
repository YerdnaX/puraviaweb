var express = require('express')
var router = express.Router()
var database = require('./database')
var sql = database.sql
var crypto = require('crypto')
var fs = require('fs')
var path = require('path')

// Helper simple para hash de contrasena (sha256)
function hashPassword(plain) {
    return crypto.createHash('sha256').update(plain || '').digest('hex')
}

// POST contacto (guardar mensaje de cliente)
router.post('/contacto', async function (req, res, next) {
    try {
        const { nombre, correo, telefono, asunto, mensaje } = req.body
        if (!nombre || !correo || !asunto || !mensaje) {
            return res.status(400).json({ error: 'Nombre, correo, asunto y mensaje son obligatorios' })
        }
        const pool = await database.poolPromise
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('correo', sql.VarChar, correo)
            .input('telefono', sql.VarChar, telefono || null)
            .input('asunto', sql.VarChar, asunto)
            .input('mensaje', sql.VarChar, mensaje)
            .query(`INSERT INTO contacto (nombre, correo, telefono, asunto, mensaje) VALUES (@nombre, @correo, @telefono, @asunto, @mensaje)`)
        res.json({ ok: true, message: 'Contacto guardado' })
    } catch (err) {
        console.error('Error al guardar contacto:', err)
        res.status(500).json({ error: 'Error al guardar contacto' })
    }
})

// POST endpoint para insertar usuario
router.post('/insertarusuario', async function (req, res, next) {
    try {
        const { nombre, correo, usuario, password, rol, estado, notas } = req.body

        if (!nombre || !usuario || !password) {
            return res.status(400).json({ error: 'Nombre, usuario y contrasena son obligatorios' })
        }

        const pool = await database.poolPromise
        try {
            const result = await pool
                .request()
                .input('nombre', sql.VarChar, nombre)
                .input('correo', sql.VarChar, correo || null)
                .input('username', sql.VarChar, usuario)
                .input('password_hash', sql.VarChar, hashPassword(password))
                .input('rol', sql.VarChar, rol || 'mesero')
                .input('estado', sql.VarChar, estado || 'Activo')
                .input('notas', sql.VarChar, notas || null)
                .query(
                    `INSERT INTO usuario (nombre, correo, username, password_hash, rol, estado, notas)
                     VALUES (@nombre, @correo, @username, @password_hash, @rol, @estado, @notas);
                     SELECT SCOPE_IDENTITY() AS id;`
                )

            const usuarioId = parseInt(result.recordset[0].id, 10)
            res.json({ ok: true, id: usuarioId, message: 'Usuario agregado exitosamente' })
        } catch (errDb) {
            if (errDb.number === 2627 || errDb.number === 2601) {
                return res.status(400).json({ error: 'Usuario ya existe' })
            }
            throw errDb
        }
    } catch (err) {
        console.error('Error al agregar usuario:', err)
        res.status(500).json({ error: 'Error al agregar usuario' })
    }
})

// DELETE usuario (elimina mesero asociado si existe)
router.delete('/usuario/:id', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ error: 'Id invalido' })

    try {
        const pool = await database.poolPromise

        // ¿Está asociado a un mesero? ¿Tiene órdenes?
        const meseroInfo = await pool.request()
            .input('usuarioId', sql.Int, id)
            .query(`SELECT m.id AS mesero_id, COUNT(o.id) AS ordenes
                    FROM mesero m
                    LEFT JOIN orden o ON o.mesero_id = m.id
                    WHERE m.usuario_id = @usuarioId
                    GROUP BY m.id`)

        if (meseroInfo.recordset.length) {
            const ordenes = meseroInfo.recordset[0].ordenes
            if (ordenes > 0) {
                return res.status(400).json({ error: 'No se puede eliminar: el usuario es mesero y tiene órdenes asociadas.' })
            }
            return res.status(400).json({ error: 'No se puede eliminar: el usuario está asociado a un mesero. Elimine o reasigne el mesero primero.' })
        }

        const resultUser = await pool.request()
            .input('usuarioId', sql.Int, id)
            .query(`DELETE FROM usuario WHERE id = @usuarioId`)

        if (resultUser.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }
        res.json({ ok: true, message: 'Usuario eliminado' })
    } catch (err) {
        console.error('Error al eliminar usuario:', err)
        if (err.number === 547) {
            return res.status(400).json({ error: 'No se puede eliminar: existen dependencias (meseros u órdenes).' })
        }
        res.status(500).json({ error: 'Error al eliminar usuario' })
    }
})

// PUT usuario (actualizar datos)
router.put('/usuario/:id', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ error: 'Id invalido' })

    const { nombre, correo, usuario, password, estado, notas, rol } = req.body
    if (!nombre || !usuario) {
        return res.status(400).json({ error: 'Nombre y usuario son obligatorios' })
    }

    const pool = await database.poolPromise
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        // validar username unico
        const dup = await new sql.Request(transaction)
            .input('username', sql.VarChar, usuario)
            .input('id', sql.Int, id)
            .query(`SELECT COUNT(1) as cnt FROM usuario WHERE username = @username AND id <> @id`)
        if (dup.recordset[0].cnt > 0) {
            await transaction.rollback()
            return res.status(400).json({ error: 'Usuario ya existe' })
        }

        let query = `UPDATE usuario
                     SET nombre=@nombre, correo=@correo, username=@username, rol=@rol, estado=@estado, notas=@notas`
        if (password) {
            query += `, password_hash=@password_hash`
        }
        query += ` WHERE id=@id`

        const reqUpdate = new sql.Request(transaction)
            .input('nombre', sql.VarChar, nombre)
            .input('correo', sql.VarChar, correo || null)
            .input('username', sql.VarChar, usuario)
            .input('rol', sql.VarChar, rol || 'mesero')
            .input('estado', sql.VarChar, estado || 'Activo')
            .input('notas', sql.VarChar, notas || null)
            .input('id', sql.Int, id)
        if (password) {
            reqUpdate.input('password_hash', sql.VarChar, hashPassword(password))
        }
        const result = await reqUpdate.query(query)

        await transaction.commit()
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }
        res.json({ ok: true, message: 'Usuario actualizado' })
    } catch (err) {
        await transaction.rollback()
        console.error('Error al actualizar usuario:', err)
        res.status(500).json({ error: 'Error al actualizar usuario' })
    }
})

// POST endpoint para insertar mesero
router.post('/insertarmesero', async function (req, res, next) {
    try {
        const { nombre, identificacion, telefono, correo, turno, usuario, password, observaciones } = req.body

        // Validar campos obligatorios
        if (!nombre || !identificacion || !usuario || !password) {
            return res.status(400).json({ error: 'Nombre, identificacion, usuario y contrasena son obligatorios' })
        }

        const pool = await database.poolPromise
        const transaction = new sql.Transaction(pool)
        await transaction.begin()

        try {
            // 1) Crear usuario y capturar su ID (username es unico)
            const userResult = await new sql.Request(transaction)
                .input('nombre', sql.VarChar, nombre)
                .input('correo', sql.VarChar, correo || null)
                .input('username', sql.VarChar, usuario)
                .input('password_hash', sql.VarChar, hashPassword(password))
                .input('rol', sql.VarChar, 'mesero')
                .input('notas', sql.VarChar, observaciones || null)
                .query(
                    `INSERT INTO usuario (nombre, correo, username, password_hash, rol, notas)
                     VALUES (@nombre, @correo, @username, @password_hash, @rol, @notas);
                     SELECT SCOPE_IDENTITY() AS id;`
                )

            const usuarioId = parseInt(userResult.recordset[0].id, 10)

            // 2) Crear mesero referenciando el usuario recien creado
            await new sql.Request(transaction)
                .input('nombre', sql.VarChar, nombre)
                .input('identificacion', sql.VarChar, identificacion)
                .input('telefono', sql.VarChar, telefono || null)
                .input('correo', sql.VarChar, correo || null)
                .input('turno', sql.VarChar, turno || 'Manana')
                .input('usuario_id', sql.Int, usuarioId)
                .input('observaciones', sql.VarChar, observaciones || null)
                .query(
                    `INSERT INTO mesero (nombre, identificacion, telefono, correo, turno, usuario_id, observaciones)
                     VALUES (@nombre, @identificacion, @telefono, @correo, @turno, @usuario_id, @observaciones)`
                )

            await transaction.commit()
            res.json({ message: 'Mesero agregado exitosamente', ok: true })
        } catch (errTx) {
            await transaction.rollback()
            if (errTx.number === 2627 || errTx.number === 2601) {
                return res.status(400).json({ error: 'Usuario o identificacion ya existe' })
            }
            throw errTx
        }
    } catch (err) {
        console.error('Error al agregar mesero:', err)
        res.status(500).json({ error: 'Error al agregar mesero' })
    }
})

// DELETE mesero (y opcionalmente su usuario)
router.delete('/mesero/:id', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    const usuarioId = parseInt(req.query.usuarioId, 10) || null
    if (!id) return res.status(400).json({ error: 'Id invalido' })

    try {
        const pool = await database.poolPromise

        // ¿Tiene órdenes asociadas?
        const ordenes = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT COUNT(1) AS cnt FROM orden WHERE mesero_id = @id`)
        if (ordenes.recordset[0].cnt > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: el mesero tiene órdenes asociadas.' })
        }

        const transaction = new sql.Transaction(pool)
        await transaction.begin()
        try {
            const delMesero = await new sql.Request(transaction)
                .input('id', sql.Int, id)
                .query(`DELETE FROM mesero WHERE id = @id`)

            if (usuarioId) {
                await new sql.Request(transaction)
                    .input('usuarioId', sql.Int, usuarioId)
                    .query(`DELETE FROM usuario WHERE id = @usuarioId`)
            }

            await transaction.commit()

            if (delMesero.rowsAffected[0] === 0) {
                return res.status(404).json({ error: 'Mesero no encontrado' })
            }
            res.json({ ok: true, message: 'Mesero eliminado' })
        } catch (txErr) {
            await transaction.rollback()
            throw txErr
        }
    } catch (err) {
        console.error('Error al eliminar mesero:', err)
        if (err.number === 547) {
            return res.status(400).json({ error: 'No se puede eliminar: el mesero tiene dependencias (órdenes u otros datos).' })
        }
        res.status(500).json({ error: 'Error al eliminar mesero' })
    }
})

// PUT mesero (actualizar datos + usuario asociado)
router.put('/mesero/:id', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    const usuarioId = parseInt(req.query.usuarioId, 10)
    if (!id || !usuarioId) return res.status(400).json({ error: 'Id invalido' })

    const { nombre, identificacion, telefono, correo, turno, usuario, password, observaciones } = req.body
    if (!nombre || !identificacion || !usuario) {
        return res.status(400).json({ error: 'Nombre, identificacion y usuario son obligatorios' })
    }

    const pool = await database.poolPromise
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        // validar identificacion unica (en otros meseros)
        const dupId = await new sql.Request(transaction)
            .input('identificacion', sql.VarChar, identificacion)
            .input('id', sql.Int, id)
            .query(`SELECT COUNT(1) as cnt FROM mesero WHERE identificacion = @identificacion AND id <> @id`)
        if (dupId.recordset[0].cnt > 0) {
            await transaction.rollback()
            return res.status(400).json({ error: 'Identificación ya existe' })
        }

        // validar username unico (en otros usuarios)
        const dupUser = await new sql.Request(transaction)
            .input('username', sql.VarChar, usuario)
            .input('usuarioId', sql.Int, usuarioId)
            .query(`SELECT COUNT(1) as cnt FROM usuario WHERE username = @username AND id <> @usuarioId`)
        if (dupUser.recordset[0].cnt > 0) {
            await transaction.rollback()
            return res.status(400).json({ error: 'Usuario ya existe' })
        }

        // actualizar usuario
        let qUser = `UPDATE usuario
                     SET nombre=@nombre, correo=@correo, username=@username, notas=@notas
                     WHERE id=@usuarioId`
        if (password) {
            qUser = `UPDATE usuario
                     SET nombre=@nombre, correo=@correo, username=@username, notas=@notas, password_hash=@password_hash
                     WHERE id=@usuarioId`
        }
        const reqUser = new sql.Request(transaction)
            .input('nombre', sql.VarChar, nombre)
            .input('correo', sql.VarChar, correo || null)
            .input('username', sql.VarChar, usuario)
            .input('notas', sql.VarChar, observaciones || null)
            .input('usuarioId', sql.Int, usuarioId)
        if (password) {
            reqUser.input('password_hash', sql.VarChar, hashPassword(password))
        }
        await reqUser.query(qUser)

        // actualizar mesero
        const resultMesero = await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('identificacion', sql.VarChar, identificacion)
            .input('telefono', sql.VarChar, telefono || null)
            .input('correo', sql.VarChar, correo || null)
            .input('turno', sql.VarChar, turno || 'Manana')
            .input('observaciones', sql.VarChar, observaciones || null)
            .query(`UPDATE mesero
                    SET nombre=@nombre, identificacion=@identificacion, telefono=@telefono, correo=@correo, turno=@turno, observaciones=@observaciones
                    WHERE id=@id`)

        await transaction.commit()

        if (resultMesero.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Mesero no encontrado' })
        }
        res.json({ ok: true, message: 'Mesero actualizado' })
    } catch (err) {
        await transaction.rollback()
        console.error('Error al actualizar mesero:', err)
        res.status(500).json({ error: 'Error al actualizar mesero' })
    }
})

// Cerrar orden y liberar mesa
router.post('/orden/:id/cerrar', async function (req, res, next) {
    const ordenId = parseInt(req.params.id, 10)
    if (!ordenId) return res.status(400).json({ error: 'Id de orden invalido' })

    const pool = await database.poolPromise
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        const ordRs = await new sql.Request(transaction)
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT id, mesa_id FROM orden WHERE id = @ordenId AND estado = 'abierta'`)

        if (!ordRs.recordset.length) {
            await transaction.rollback()
            return res.status(404).json({ error: 'Orden no encontrada o ya cerrada' })
        }

        const mesaId = ordRs.recordset[0].mesa_id

        const totRs = await new sql.Request(transaction)
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT SUM(subtotal) AS subtotal FROM orden_detalle WHERE orden_id = @ordenId`)
        const subtotal = Number(totRs.recordset[0].subtotal || 0)
        const impuesto = Number((subtotal * 0.13).toFixed(2))
        const total = Number((subtotal + impuesto).toFixed(2))

        await new sql.Request(transaction)
            .input('total', sql.Decimal(12, 2), total)
            .input('ordenId', sql.Int, ordenId)
            .query(`UPDATE orden
                    SET estado = 'cerrada',
                        total = @total,
                        cerrada_en = SYSDATETIME()
                    WHERE id = @ordenId`)

        await new sql.Request(transaction)
            .input('mesaId', sql.Int, mesaId)
            .query(`UPDATE mesa SET estado = 'libre' WHERE id = @mesaId`)

        await transaction.commit()
        res.json({ ok: true, subtotal, impuesto, total })
    } catch (err) {
        await transaction.rollback()
        console.error('Error al cerrar orden:', err)
        res.status(500).json({ error: 'Error al cerrar orden' })
    }
})

// Agregar producto a orden abierta
router.post('/orden/:id/agregar', async function (req, res, next) {
    const ordenId = parseInt(req.params.id, 10)
    const { productoId, cantidad, observaciones } = req.body

    if (!ordenId) return res.status(400).json({ error: 'Id de orden invalido' })
    if (!productoId || !cantidad || cantidad < 1) {
        return res.status(400).json({ error: 'Producto y cantidad son obligatorios' })
    }

    const pool = await database.poolPromise
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        // validar orden abierta
        const ord = await new sql.Request(transaction)
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT estado FROM orden WHERE id = @ordenId`)
        if (!ord.recordset.length) {
            await transaction.rollback()
            return res.status(404).json({ error: 'Orden no encontrada' })
        }
        if (ord.recordset[0].estado !== 'abierta') {
            await transaction.rollback()
            return res.status(400).json({ error: 'La orden no está abierta' })
        }

        // obtener precio del producto
        const prod = await new sql.Request(transaction)
            .input('prodId', sql.Int, productoId)
            .query(`SELECT precio FROM producto WHERE id = @prodId AND activo = 1`)
        if (!prod.recordset.length) {
            await transaction.rollback()
            return res.status(404).json({ error: 'Producto no encontrado o inactivo' })
        }
        const precioUnit = prod.recordset[0].precio

        // insertar detalle
        await new sql.Request(transaction)
            .input('ordenId', sql.Int, ordenId)
            .input('prodId', sql.Int, productoId)
            .input('cantidad', sql.Int, cantidad)
            .input('precio', sql.Decimal(10,2), precioUnit)
            .input('obs', sql.VarChar, observaciones || null)
            .query(`INSERT INTO orden_detalle (orden_id, producto_id, cantidad, precio_unit, observaciones)
                    VALUES (@ordenId, @prodId, @cantidad, @precio, @obs)`)

        await transaction.commit()
        res.json({ ok: true })
    } catch (err) {
        await transaction.rollback()
        console.error('Error al agregar producto a orden:', err)
        res.status(500).json({ error: 'Error al agregar producto a la orden' })
    }
})

// Crear reserva de mesa
router.post('/reserva', async function (req, res, next) {
    const { mesa, nombre, telefono, fecha, hora, notas, cantidad_personas } = req.body

    if (!mesa || !nombre || !fecha || !hora) {
        return res.status(400).json({ error: 'Mesa, nombre, fecha y hora son obligatorios' })
    }

    const fechaHoraIso = `${fecha}T${hora}`
    const fechaHora = new Date(fechaHoraIso)
    if (isNaN(fechaHora.getTime())) {
        return res.status(400).json({ error: 'Fecha u hora inválida' })
    }

    try {
        const pool = await database.poolPromise

        // localizar mesa por numero
        const mesaRs = await pool.request()
            .input('numero', sql.Int, parseInt(mesa, 10))
            .query('SELECT id FROM mesa WHERE numero = @numero')
        if (!mesaRs.recordset.length) {
            return res.status(404).json({ error: 'Mesa no encontrada' })
        }
        const mesaId = mesaRs.recordset[0].id

        // verificar conflicto exacto fecha/hora para esa mesa
        const dup = await pool.request()
            .input('mesaId', sql.Int, mesaId)
            .input('fechaConsulta', sql.Date, fecha)
            .input('horaConsulta', sql.VarChar, hora)
            .query(`SELECT COUNT(1) AS cnt
                    FROM reserva
                    WHERE mesa_id = @mesaId
                      AND CAST(fecha_hora AS date) = @fechaConsulta
                      AND FORMAT(fecha_hora, 'HH:mm') = @horaConsulta
                      AND estado <> 'cancelada'`)
        if (dup.recordset[0].cnt > 0) {
            return res.status(400).json({ error: 'Ya existe una reserva para esa mesa en la misma hora' })
        }

        await pool.request()
            .input('mesaId', sql.Int, mesaId)
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .input('fechaHora', sql.DateTime2, fechaHora)
            .input('cant', sql.Int, cantidad_personas || null)
            .input('nota', sql.VarChar, notas || null)
            .query(`INSERT INTO reserva (mesa_id, cliente_nombre, cliente_telefono, fecha_hora, cantidad_personas, nota)
                    VALUES (@mesaId, @nombre, @telefono, @fechaHora, ISNULL(@cant, 2), @nota)`)

        res.json({ ok: true, message: 'Reserva creada' })
    } catch (err) {
        console.error('Error al crear reserva:', err)
        res.status(500).json({ error: 'Error al crear reserva' })
    }
})

// Consultar reservas por mesa y fecha
router.get('/reserva', async function (req, res, next) {
    const mesa = parseInt(req.query.mesa, 10)
    const fecha = req.query.fecha

    if (!mesa || !fecha) {
        return res.status(400).json({ error: 'Mesa y fecha son obligatorios' })
    }

    try {
        const pool = await database.poolPromise

        const rs = await pool.request()
            .input('numero', sql.Int, mesa)
            .input('fechaConsulta', sql.Date, fecha)
            .query(`SELECT r.id, CONVERT(VARCHAR(5), r.fecha_hora, 108) AS hora, r.cliente_nombre, r.estado
                    FROM reserva r
                    JOIN mesa m ON r.mesa_id = m.id
                    WHERE m.numero = @numero AND CAST(r.fecha_hora AS date) = @fechaConsulta
                    ORDER BY r.fecha_hora`)

        res.json({ ok: true, reservas: rs.recordset })
    } catch (err) {
        console.error('Error al consultar reservas:', err)
        res.status(500).json({ error: 'Error al consultar reservas' })
    }
})

// Eliminar reserva
router.delete('/reserva/:id', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ error: 'Id invalido' })

    try {
        const pool = await database.poolPromise
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM reserva WHERE id = @id')

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada' })
        }

        res.json({ ok: true, message: 'Reserva eliminada' })
    } catch (err) {
        console.error('Error al eliminar reserva:', err)
        res.status(500).json({ error: 'Error al eliminar reserva' })
    }
})

// Actualizar estado de reserva
router.put('/reserva/:id/estado', async function (req, res, next) {
    const id = parseInt(req.params.id, 10)
    const { estado } = req.body
    if (!id) return res.status(400).json({ error: 'Id invalido' })
    if (!estado || !['pendiente', 'confirmada', 'cancelada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado invalido' })
    }

    try {
        const pool = await database.poolPromise
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('estado', sql.VarChar, estado)
            .query('UPDATE reserva SET estado = @estado WHERE id = @id')

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada' })
        }

        res.json({ ok: true, message: 'Estado actualizado' })
    } catch (err) {
        console.error('Error al actualizar estado de reserva:', err)
        res.status(500).json({ error: 'Error al actualizar estado de reserva' })
    }
})

// Generar archivo de factura (JSON) para una orden
router.post('/orden/:id/imprimir', async function (req, res, next) {
    const ordenId = parseInt(req.params.id, 10)
    if (!ordenId) return res.status(400).json({ error: 'Id de orden invalido' })

    try {
        const pool = await database.poolPromise

        const ordRs = await pool.request()
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT o.id, o.mesa_id, o.estado, o.total, o.creada_en, o.cerrada_en, m.numero AS mesa_numero
                    FROM orden o
                    JOIN mesa m ON o.mesa_id = m.id
                    WHERE o.id = @ordenId`)

        if (!ordRs.recordset.length) {
            return res.status(404).json({ error: 'Orden no encontrada' })
        }
        const orden = ordRs.recordset[0]

        const detRs = await pool.request()
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT od.id, p.nombre, od.cantidad, od.precio_unit, od.subtotal, od.observaciones
                    FROM orden_detalle od
                    JOIN producto p ON od.producto_id = p.id
                    WHERE od.orden_id = @ordenId`)
        const detalles = detRs.recordset

        const totRs = await pool.request()
            .input('ordenId', sql.Int, ordenId)
            .query(`SELECT SUM(subtotal) AS subtotal FROM orden_detalle WHERE orden_id = @ordenId`)
        const subtotal = Number(totRs.recordset[0].subtotal || 0)
        const impuesto = Number((subtotal * 0.13).toFixed(2))
        const total = Number((subtotal + impuesto).toFixed(2))

        const factura = {
            orden_id: orden.id,
            mesa: orden.mesa_numero,
            estado: orden.estado,
            creada_en: orden.creada_en,
            cerrada_en: orden.cerrada_en,
            items: detalles.map(d => ({
                id: d.id,
                producto: d.nombre,
                cantidad: d.cantidad,
                precio_unit: Number(d.precio_unit),
                subtotal: Number(d.subtotal),
                observaciones: d.observaciones
            })),
            subtotal,
            impuesto,
            total
        }

        const facturasDir = path.join(__dirname, '..', 'facturas')
        if (!fs.existsSync(facturasDir)) {
            fs.mkdirSync(facturasDir, { recursive: true })
        }
        const filePath = path.join(facturasDir, `factura_${ordenId}.json`)
        fs.writeFileSync(filePath, JSON.stringify(factura, null, 2), 'utf8')

        res.json({ ok: true, message: 'Factura generada', archivo: filePath })
    } catch (err) {
        console.error('Error al generar factura:', err)
        res.status(500).json({ error: 'Error al generar factura' })
    }
})

module.exports = router
