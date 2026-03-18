function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function getQueryMesa() {
  const params = new URLSearchParams(window.location.search)
  return params.get('mesa')
}

function renderReservas(reservas) {
  const tbody = document.getElementById('reservas-body')
  tbody.innerHTML = ''
  if (!reservas || !reservas.length) {
    const tr = document.createElement('tr')
    tr.innerHTML = '<td colspan="4">Sin reservas para esta fecha.</td>'
    tbody.appendChild(tr)
    return
  }

  reservas.forEach(r => {
    const tr = document.createElement('tr')
    const estadoClass = r.estado === 'cancelada' ? 'estado-libre' : 'estado-reservada'
    tr.innerHTML = `
      <td>${r.hora}</td>
      <td>${r.cliente_nombre}</td>
      <td>
        <select class="select-estado-reserva" onchange="CambiarEstadoReserva(${r.id}, this.value)">
          <option value="pendiente" ${r.estado === 'pendiente' ? 'selected' : ''}>pendiente</option>
          <option value="confirmada" ${r.estado === 'confirmada' ? 'selected' : ''}>confirmada</option>
          <option value="cancelada" ${r.estado === 'cancelada' ? 'selected' : ''}>cancelada</option>
        </select>
      </td>
      <td><button class="btn btn-secundario" type="button" onclick="EliminarReserva(${r.id})">Eliminar</button></td>
    `
    tbody.appendChild(tr)
  })
}

async function cargarReservas() {
  const mesa = document.getElementById('mesa').value
  const fecha = document.getElementById('fecha-consulta').value
  if (!mesa || !fecha) return
  try {
    const resp = await fetch(`/api/reserva?mesa=${mesa}&fecha=${fecha}`)
    const data = await resp.json()
    if (!resp.ok || data.error) {
      alert(data.error || 'No se pudo consultar las reservas')
      return
    }
    renderReservas(data.reservas)
  } catch (err) {
    console.error(err)
    alert('Error de red al consultar reservas')
  }
}

async function CrearReserva() {
  const mesa = document.getElementById('mesa').value
  const nombre = document.getElementById('nombre').value.trim()
  const fecha = document.getElementById('fecha').value
  const hora = document.getElementById('hora').value
  const notas = document.getElementById('notas').value.trim()

  if (!mesa || !nombre || !fecha || !hora) {
    alert('Mesa, nombre, fecha y hora son obligatorios')
    return
  }

  try {
    const resp = await fetch('/api/reserva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa, nombre, fecha, hora, notas })
    })
    const data = await resp.json()
    if (!resp.ok || data.error) {
      alert(data.error || 'No se pudo crear la reserva')
      return
    }
    alert('Reserva creada')
    cargarReservas()
  } catch (err) {
    console.error(err)
    alert('Error de red al crear reserva')
  }
}

function initReservaUI() {
  const hoy = hoyISO()
  const fechaInput = document.getElementById('fecha')
  const fechaConsulta = document.getElementById('fecha-consulta')
  if (fechaInput && !fechaInput.value) fechaInput.value = hoy
  if (fechaConsulta && !fechaConsulta.value) fechaConsulta.value = hoy

  const mesaParam = getQueryMesa()
  if (mesaParam) {
    const select = document.getElementById('mesa')
    if ([...select.options].some(o => o.value === mesaParam)) {
      select.value = mesaParam
    }
  }

  document.getElementById('mesa').addEventListener('change', cargarReservas)
  document.getElementById('fecha-consulta').addEventListener('change', cargarReservas)

  cargarReservas()
}

document.addEventListener('DOMContentLoaded', initReservaUI)

async function EliminarReserva(id) {
  if (!id) return
  if (!confirm('¿Eliminar esta reserva?')) return
  try {
    const resp = await fetch(`/api/reserva/${id}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!resp.ok || data.error) {
      alert(data.error || 'No se pudo eliminar la reserva')
      return
    }
    cargarReservas()
  } catch (err) {
    console.error(err)
    alert('Error de red al eliminar reserva')
  }
}

window.EliminarReserva = EliminarReserva

async function CambiarEstadoReserva(id, estado) {
  try {
    const resp = await fetch(`/api/reserva/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    })
    const data = await resp.json()
    if (!resp.ok || data.error) {
      alert(data.error || 'No se pudo actualizar el estado')
      return
    }
    // recargar lista para reflejar estilos si fuera necesario
    cargarReservas()
  } catch (err) {
    console.error(err)
    alert('Error de red al actualizar estado')
  }
}

window.CambiarEstadoReserva = CambiarEstadoReserva
