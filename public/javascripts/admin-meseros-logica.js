//Funcion para guardar o actualizar un mesero

async function GuardarActualizarMesero() {
    const nombre = document.getElementById('nombre').value.trim()
    const identificacion = document.getElementById('id').value.trim()
    const telefono = document.getElementById('telefono').value.trim()
    const correo = document.getElementById('correo').value.trim()
    const turno = document.getElementById('turno').value
    const usuario = document.getElementById('usuario').value.trim()
    const password = document.getElementById('password').value
    const observaciones = document.getElementById('observaciones').value.trim()

    if (!nombre || !identificacion || !usuario || !password) {
        alert('Nombre, identificación, usuario y contraseña son obligatorios')
        return
    }

    const filaExistente = document.querySelector(
        `#tabla-meseros tr[data-identificacion="${identificacion}"]`
    )

    const datosparausar = {
        nombre,
        identificacion,
        telefono,
        correo,
        turno,
        usuario,
        password,
        observaciones,
    }

    if (filaExistente) {
        const meseroId = filaExistente.dataset.id
        const usuarioId = filaExistente.dataset.usuarioId
        const confirmar = confirm('Este mesero ya existe. ¿Deseas actualizarlo?')
        if (!confirmar) return
        await actualizarMesero(meseroId, usuarioId, datosparausar)
    } else {
        await crearMesero(datosparausar)
    }
}

window.GuardarActualizarMesero = GuardarActualizarMesero;

async function crearMesero(payload) {
    try {
        const resp = await fetch('/api/insertarmesero', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al guardar mesero')
            return
        }

        location.reload()
    } catch (error) {
        console.error('Error:', error)
        alert('Error de red al guardar mesero')
    }
}

async function actualizarMesero(id, usuarioId, payload) {
    try {
        const resp = await fetch(`/api/mesero/${id}?usuarioId=${usuarioId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al actualizar mesero')
            return
        }

        location.reload()
    } catch (error) {
        console.error('Error:', error)
        alert('Error de red al actualizar mesero')
    }
}


//Funcion para eliminar un mesero
async function EliminarMesero(id, usuarioId) {
    if (!confirm('¿Eliminar este mesero?')) return

    try {
        const resp = await fetch(`/api/mesero/${id}?usuarioId=${usuarioId}`, { method: 'DELETE' })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al eliminar mesero')
            return
        }
        location.reload()
    } catch (error) {
        console.error('Error:', error)
        alert('Error de red al eliminar mesero')
    }
}

window.EliminarMesero = EliminarMesero;
