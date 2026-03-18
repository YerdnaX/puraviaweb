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

    try {
        const resp = await fetch('/api/insertarusuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre,
                correo,
                usuario,
                password,
                estado,
                notas
            })
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


window.GuardarActualizarUsuario = GuardarActualizarUsuario
