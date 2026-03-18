async function FinalizarOrden() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }
    if (!confirm('¿Marcar la orden como finalizada y liberar la mesa?')) return

    try {
        const resp = await fetch(`/api/orden/${ordenId}/cerrar`, { method: 'POST' })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'No se pudo cerrar la orden')
            return
        }
        alert('Orden cerrada y mesa liberada')
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al cerrar la orden')
    }
}

window.FinalizarOrden = FinalizarOrden

async function AgregarAOrden() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }
    const productoId = document.getElementById('producto').value
    const cantidad = parseInt(document.getElementById('cantidad').value, 10)
    const observaciones = document.getElementById('observaciones').value.trim()

    if (!productoId) {
        alert('Selecciona un producto')
        return
    }
    if (!cantidad || cantidad < 1) {
        alert('La cantidad debe ser mayor o igual a 1')
        return
    }

    try {
        const resp = await fetch(`/api/orden/${ordenId}/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productoId, cantidad, observaciones })
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'No se pudo agregar el producto')
            return
        }
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al agregar producto')
    }
}

window.AgregarAOrden = AgregarAOrden

async function ImprimirFactura() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }
    try {
        const resp = await fetch(`/api/orden/${ordenId}/imprimir`, { method: 'POST' })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'No se pudo generar la factura')
            return
        }
        alert(`Factura generada: ${data.archivo}`)
    } catch (err) {
        console.error(err)
        alert('Error de red al generar la factura')
    }
}

window.ImprimirFactura = ImprimirFactura
