var express = require('express')
var router = express.Router()
var database = require('./database')
var sql = database.sql

// POST endpoint para insertar mesero
router.post('/insertarmesero', async function (req, res, next) {
    try {
        const { nombre, identificacion, telefono, correo, turno, usuario_id, observaciones } = req.body;
        
        // Validar campos obligatorios
        if (!nombre || !identificacion) {
            return res.status(400).json({ error: 'Nombre e identificación son obligatorios' });
        }

        const pool = await database.poolPromise;
        const result = await pool
            .request()
            .input('nombre', sql.VarChar, nombre)
            .input('identificacion', sql.VarChar, identificacion)
            .input('telefono', sql.VarChar, telefono || null)
            .input('correo', sql.VarChar, correo || null)
            .input('turno', sql.VarChar, turno || null)
            .input('usuario_id', sql.VarChar, usuario_id || null)
            .input('observaciones', sql.VarChar, observaciones || null)
            .query(
                `INSERT INTO mesero (nombre, identificacion, telefono, correo, turno, usuario_id, observaciones)
                 VALUES (@nombre, @identificacion, @telefono, @correo, @turno, @usuario_id, @observaciones)`
            );
        
        res.json({ message: 'Mesero agregado exitosamente', ok: true });
    } catch (err) {
        console.error('Error al agregar mesero:', err);
        res.status(500).json({ error: 'Error al agregar mesero' });
    }
})

module.exports = router