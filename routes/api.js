var express = require('express')
var router = express.Router()
var database = require('./database')
var sql = database.sql
var crypto = require('crypto')

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

module.exports = router
