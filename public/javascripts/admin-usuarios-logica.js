//Funciones para guardar actualizar usuarios
async function GuardarActualizarUsuario() {
    const nombre = document.getElementById('nombre').value.trim()
    const correo = document.getElementById('correo').value.trim()
    const usuario = document.getElementById('usuario').value.trim()
    const estado = document.getElementById('estado').value
    const password = document.getElementById('password').value
    const confirmar = document.getElementById('confirmar').value
    const notas = document.getElementById('notas').value.trim()

    if (!nombre || !usuario || !password) {
        alert('Nombre, usuario y contraseña son obligatorios')
        return
    }

    if (password !== confirmar) {
        alert('Las contraseñas no coinciden')
        return
    }

    // ¿Existe ya en la tabla?
    const filaExistente = document.querySelector(
        `#tabla-usuarios tr[data-username="${usuario}"]`
    )

    const datosparausar = { nombre, correo, usuario, password, estado, notas }

    if (filaExistente) {
        const id = filaExistente.dataset.id
        const confirmar = confirm('Este usuario ya existe. ¿Deseas actualizarlo?')
        if (!confirmar) return
        await actualizarUsuario(id, datosparausar)
    } else {
        await crearUsuario(datosparausar)
    }
}


window.GuardarActualizarUsuario = GuardarActualizarUsuario

async function crearUsuario(datosparausar) {
    try {
        const resp = await fetch('/api/insertarusuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosparausar)
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al guardar usuario')
            return
        }
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al guardar usuario')
    }
}

async function actualizarUsuario(id, datosparausar) {
    try {
        const resp = await fetch(`/api/usuario/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosparausar)
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al actualizar usuario')
            return
        }
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al actualizar usuario')
    }
}

//Funcion para eliminar un usuario
async function EliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return

    try {
        const resp = await fetch(`/api/usuario/${id}`, { method: 'DELETE' })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al eliminar usuario')
            return
        }
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al eliminar usuario')
    }
}

window.EliminarUsuario = EliminarUsuario
