// ====== Configuración ======
const CLAVE_ALMACEN = "khipu.movimientos";
const formateadorMontos = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ====== Elementos del HTML ======
const formulario = document.getElementById("formulario");
const tituloFormulario = document.getElementById("titulo-formulario");
const botonGuardar = document.getElementById("boton-guardar");
const botonCancelarEdicion = document.getElementById("cancelar-edicion");
const campoFecha = document.getElementById("fecha");
const campoConcepto = document.getElementById("concepto");
const campoMonto = document.getElementById("monto");
const mensajeError = document.getElementById("error");
const lista = document.getElementById("lista");
const mensajeVacio = document.getElementById("vacio");
const tituloMovimientos = document.getElementById("titulo-movimientos");
const totalIngresos = document.getElementById("total-ingresos");
const totalEgresos = document.getElementById("total-egresos");
const tarjetaSaldo = document.getElementById("tarjeta-saldo");
const saldoTexto = document.getElementById("saldo");
const dialogoEliminar = document.getElementById("dialogo-eliminar");
const dialogoConcepto = document.getElementById("dialogo-concepto");
const dialogoDetalle = document.getElementById("dialogo-detalle");
const botonCancelarEliminar = document.getElementById("cancelar-eliminar");
const botonConfirmarEliminar = document.getElementById("confirmar-eliminar");
const toast = document.getElementById("toast");
const toastTexto = document.getElementById("toast-texto");

// ====== Datos guardados en el navegador ======
function generarId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cargarMovimientos() {
  const datos = localStorage.getItem(CLAVE_ALMACEN);
  if (!datos) return [];

  try {
    const guardados = JSON.parse(datos);
    if (!Array.isArray(guardados)) return [];

    // Los movimientos antiguos no tienen id: se lo añadimos una sola vez.
    let huboCambios = false;
    const migrados = guardados.map((movimiento) => {
      if (typeof movimiento.id === "string" && movimiento.id) {
        return movimiento;
      }
      huboCambios = true;
      return { ...movimiento, id: generarId() };
    });

    if (huboCambios) {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(migrados));
    }
    return migrados;
  } catch {
    // Si los datos están dañados, empezamos de cero.
    return [];
  }
}

function guardarMovimientos() {
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(movimientos));
}

// ====== Estado ======
let movimientos = cargarMovimientos();
let idEnEdicion = null;
let idAEliminar = null;
let temporizadorToast = null;

// ====== Utilidades ======
// Fecha de hoy en formato "AAAA-MM-DD" usando la hora local.
// No usamos toISOString() porque convierte a UTC y puede cambiar el día.
function fechaDeHoy() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Pasamos de "AAAA-MM-DD" a "DD/MM/AAAA" sin crear un Date
// (crear un Date desde ese texto lo interpretaría como UTC).
function formatearFecha(fecha) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearMonto(monto) {
  return formateadorMontos.format(monto);
}

// Evita que un concepto con etiquetas HTML rompa la lista.
function escaparHtml(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ====== Pintar la interfaz ======
// mantenerScroll evita que la lista salte al principio al editar o borrar.
function renderizar(mantenerScroll = false) {
  const scrollAnterior = lista.scrollTop;

  // Totales
  const ingresos = movimientos
    .filter((movimiento) => movimiento.tipo === "ingreso")
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);

  const egresos = movimientos
    .filter((movimiento) => movimiento.tipo === "egreso")
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);

  totalIngresos.textContent = formatearMonto(ingresos);
  totalEgresos.textContent = formatearMonto(egresos);

  // Saldo: ingresos menos egresos, redondeado a céntimos.
  // Convertimos -0 en 0 para no mostrar nunca "-0,00".
  const saldo = Math.round((ingresos - egresos) * 100) / 100;
  const saldoVisible = saldo === 0 ? 0 : saldo;

  saldoTexto.textContent =
    saldoVisible < 0
      ? `−${formatearMonto(Math.abs(saldoVisible))}`
      : formatearMonto(saldoVisible);

  tarjetaSaldo.classList.remove("saldo-positivo", "saldo-negativo", "saldo-cero");
  if (saldoVisible > 0) {
    tarjetaSaldo.classList.add("saldo-positivo");
  } else if (saldoVisible < 0) {
    tarjetaSaldo.classList.add("saldo-negativo");
  } else {
    tarjetaSaldo.classList.add("saldo-cero");
  }

  // Lista ordenada: la fecha más reciente primero.
  // Si dos movimientos son del mismo día, va primero el último añadido.
  const ordenados = [...movimientos].sort((a, b) => {
    if (a.fecha !== b.fecha) {
      return a.fecha > b.fecha ? -1 : 1;
    }
    return b.creadoEn - a.creadoEn;
  });

  lista.innerHTML = ordenados.map(plantillaMovimiento).join("");

  const hayMovimientos = movimientos.length > 0;
  lista.hidden = !hayMovimientos;
  mensajeVacio.hidden = hayMovimientos;

  lista.scrollTop = mantenerScroll ? scrollAnterior : 0;
}

function plantillaMovimiento(movimiento) {
  const esIngreso = movimiento.tipo === "ingreso";
  const signo = esIngreso ? "+" : "−";
  const concepto = escaparHtml(movimiento.concepto);
  const id = escaparHtml(movimiento.id);

  return `
    <li class="movimiento ${esIngreso ? "es-ingreso" : "es-egreso"}">
      <div class="datos">
        <p class="concepto" title="${concepto}">${concepto}</p>
        <p class="fecha">${formatearFecha(movimiento.fecha)}</p>
      </div>
      <div class="lado-derecho">
        <p class="monto">${signo}${formatearMonto(movimiento.monto)}</p>
        <div class="botones-movimiento">
          <button type="button" class="boton-icono" data-accion="editar" data-id="${id}" aria-label="Editar movimiento: ${concepto}" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
          </button>
          <button type="button" class="boton-icono" data-accion="eliminar" data-id="${id}" aria-label="Eliminar movimiento: ${concepto}" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M3 6h18"></path>
              <path d="M8 6V4h8v2"></path>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>
    </li>
  `;
}

// ====== Validación y mensajes ======
function validarMovimiento(fecha, concepto, monto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return "Elige una fecha válida.";
  }
  if (fecha > fechaDeHoy()) {
    return "La fecha no puede ser futura.";
  }
  if (!concepto) {
    return "Escribe un concepto.";
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return "El monto debe ser un número mayor que 0.";
  }
  return "";
}

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

function ocultarError() {
  mensajeError.textContent = "";
  mensajeError.hidden = true;
}

// ====== Formulario: alta y edición ======
function limpiarFormulario() {
  campoConcepto.value = "";
  campoMonto.value = "";
  campoFecha.value = fechaDeHoy();
  campoConcepto.focus();
}

function salirModoEdicion() {
  idEnEdicion = null;
  tituloFormulario.textContent = "Nuevo movimiento";
  botonGuardar.textContent = "Añadir movimiento";
  botonCancelarEdicion.hidden = true;
}

function cancelarEdicion() {
  salirModoEdicion();
  limpiarFormulario();
  ocultarError();
}

function iniciarEdicion(id) {
  const movimiento = movimientos.find((m) => m.id === id);
  if (!movimiento) return;

  idEnEdicion = id;
  formulario.elements.tipo.value = movimiento.tipo;
  campoFecha.value = movimiento.fecha;
  campoConcepto.value = movimiento.concepto;
  campoMonto.value = movimiento.monto;

  tituloFormulario.textContent = "Editar movimiento";
  botonGuardar.textContent = "Guardar";
  botonCancelarEdicion.hidden = false;
  ocultarError();

  formulario.scrollIntoView({ behavior: "smooth", block: "center" });
  campoConcepto.focus({ preventScroll: true });
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const tipo = formulario.elements.tipo.value;
  const fecha = campoFecha.value;
  const concepto = campoConcepto.value.trim();
  // Redondeamos a 2 decimales para trabajar con céntimos.
  const monto = Math.round(campoMonto.valueAsNumber * 100) / 100;

  const error = validarMovimiento(fecha, concepto, monto);
  if (error) {
    mostrarError(error);
    return;
  }

  if (idEnEdicion) {
    const movimiento = movimientos.find((m) => m.id === idEnEdicion);
    if (!movimiento) {
      salirModoEdicion();
      renderizar(true);
      mostrarError("El movimiento ya no existe.");
      return;
    }

    // Actualizamos los datos, pero conservamos creadoEn para no alterar
    // el orden de los movimientos que son del mismo día.
    movimiento.tipo = tipo;
    movimiento.fecha = fecha;
    movimiento.concepto = concepto;
    movimiento.monto = monto;

    guardarMovimientos();
    renderizar(true);
    salirModoEdicion();
    limpiarFormulario();
    ocultarError();
    mostrarToast("Movimiento actualizado");
    return;
  }

  movimientos.push({
    id: generarId(),
    tipo,
    fecha,
    concepto,
    monto,
    creadoEn: Date.now(), // solo se usa para ordenar movimientos del mismo día
  });

  guardarMovimientos();
  renderizar();
  ocultarError();
  limpiarFormulario();
  mostrarToast("Movimiento registrado");
});

botonCancelarEdicion.addEventListener("click", cancelarEdicion);

// ====== Eliminar un movimiento ======
function abrirDialogoEliminar(id) {
  const movimiento = movimientos.find((m) => m.id === id);
  if (!movimiento) return;

  idAEliminar = id;
  dialogoConcepto.textContent = movimiento.concepto;

  const tipo = movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso";
  dialogoDetalle.textContent = `${tipo} · ${formatearFecha(movimiento.fecha)} · ${formatearMonto(movimiento.monto)}`;

  if (!dialogoEliminar.open) {
    dialogoEliminar.showModal();
  }
}

function cerrarDialogoEliminar() {
  idAEliminar = null;
  dialogoEliminar.close();
}

botonCancelarEliminar.addEventListener("click", cerrarDialogoEliminar);

// Si se cierra con Esc, también olvidamos el movimiento pendiente.
dialogoEliminar.addEventListener("cancel", () => {
  idAEliminar = null;
});

botonConfirmarEliminar.addEventListener("click", () => {
  if (!idAEliminar) return;

  const id = idAEliminar;
  const eraElQueSeEditaba = idEnEdicion === id;

  movimientos = movimientos.filter((movimiento) => movimiento.id !== id);
  guardarMovimientos();
  cerrarDialogoEliminar();

  if (eraElQueSeEditaba) {
    salirModoEdicion();
    limpiarFormulario();
    ocultarError();
  }

  renderizar(true);
  mostrarToast("Movimiento eliminado");
  tituloMovimientos.focus({ preventScroll: true });
});

// Delegación: un solo listener atiende los botones de todas las filas.
lista.addEventListener("click", (evento) => {
  const boton = evento.target.closest("button[data-accion]");
  if (!boton) return;

  const id = boton.dataset.id;
  if (boton.dataset.accion === "editar") {
    iniciarEdicion(id);
  } else if (boton.dataset.accion === "eliminar") {
    abrirDialogoEliminar(id);
  }
});

// ====== Toast ======
function mostrarToast(texto) {
  clearTimeout(temporizadorToast);

  toastTexto.textContent = texto;
  toast.classList.add("visible");

  // 2,7 s visible + 0,3 s de fundido = 3 s como máximo.
  temporizadorToast = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2700);
}

// ====== Arranque ======
function iniciar() {
  const hoy = fechaDeHoy();
  campoFecha.value = hoy;
  campoFecha.max = hoy; // el selector de fecha no permitirá días futuros
  renderizar();
}

iniciar();
