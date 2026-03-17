async function GuardarActualizarMesero() {
    fetch('/api/insertarmesero', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            nombre: document.getElementById('nombre').value,
            identificacion: document.getElementById('id').value,
            telefono: document.getElementById('telefono').value,
            correo: document.getElementById('correo').value,
            turno: document.getElementById('turno').value,
            usuario: document.getElementById('usuario').value,
            password: document.getElementById('password').value,
            observaciones: document.getElementById('observaciones').value
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            location.reload();
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Expone la función al ámbito global (no usar export en scripts clásicos)
window.GuardarActualizarMesero = GuardarActualizarMesero;
