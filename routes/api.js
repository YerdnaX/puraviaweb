var express = require('express')
var router = express.Router()
var database = require('./database')
var sql = database.sql
var crypto = require('crypto')

// Helper simple para hash de contraseña (sha256)
function hashPassword(plain) {
    return crypto.createHash('sha256').update(plain || '').digest('hex')
}

// POST endpoint para insertar mesero
router.post('/insertarmesero', async function (req, res, next) {
    try {
        const { nombre, identificacion, telefono, correo, turno, usuario, password, observaciones } = req.body

        // Validar campos obligatorios
        if (!nombre || !identificacion || !usuario || !password) {
            return res.status(400).json({ error: 'Nombre, identificación, usuario y contraseña son obligatorios' })
        }

        const pool = await database.poolPromise
        const transaction = new sql.Transaction(pool)
        await transaction.begin()

        try {
            // 1) Crear usuario y capturar su ID (username es único)
            const userResult = await new sql.Request(transaction)
                .input('username', sql.VarChar, usuario)
                .input('password_hash', sql.VarChar, hashPassword(password))
                .input('rol', sql.VarChar, 'mesero')
                .query(
                    `INSERT INTO usuario (username, password_hash, rol)
                     VALUES (@username, @password_hash, @rol);
                     SELECT SCOPE_IDENTITY() AS id;`
                )

            const usuarioId = parseInt(userResult.recordset[0].id, 10)

            // 2) Crear mesero referenciando el usuario recién creado
            await new sql.Request(transaction)
                .input('nombre', sql.VarChar, nombre)
                .input('identificacion', sql.VarChar, identificacion)
                .input('telefono', sql.VarChar, telefono || null)
                .input('correo', sql.VarChar, correo || null)
                .input('turno', sql.VarChar, turno || 'Mañana')
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
                return res.status(400).json({ error: 'Usuario o identificación ya existe' })
            }
            throw errTx
        }
    } catch (err) {
        console.error('Error al agregar mesero:', err)
        res.status(500).json({ error: 'Error al agregar mesero' })
    }
})

module.exports = router
