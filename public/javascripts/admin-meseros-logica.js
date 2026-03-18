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

    try {
        const resp = await fetch('/api/insertarmesero', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre,
                identificacion,
                telefono,
                correo,
                turno,
                usuario,
                password,
                observaciones
            })
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

window.GuardarActualizarMesero = GuardarActualizarMesero;
