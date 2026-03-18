async function EnviarContacto() {
    const nombre = document.getElementById('nombre').value.trim()
    const correo = document.getElementById('correo').value.trim()
    const telefono = document.getElementById('telefono').value.trim()
    const asunto = document.getElementById('asunto').value.trim()
    const mensaje = document.getElementById('mensaje').value.trim()

    if (!nombre || !correo || !asunto || !mensaje) {
        alert('Nombre, correo, asunto y mensaje son obligatorios')
        return
    }

    try {
        const resp = await fetch('/api/contacto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, telefono, asunto, mensaje })
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'Error al enviar mensaje')
            return
        }
        alert('Mensaje enviado. Te contactaremos pronto.')
        document.querySelector('form.formulario').reset()
    } catch (err) {
        console.error(err)
        alert('Error de red al enviar mensaje')
    }
}

window.EnviarContacto = EnviarContacto
