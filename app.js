// ====== Configuración ======
const CLAVE_ALMACEN = "khipu.movimientos";
const formateadorMontos = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ====== Elementos del HTML ======
const formulario = document.getElementById("formulario");
const campoFecha = document.getElementById("fecha");
const campoConcepto = document.getElementById("concepto");
const campoMonto = document.getElementById("monto");
const mensajeError = document.getElementById("error");
const lista = document.getElementById("lista");
const mensajeVacio = document.getElementById("vacio");
const totalIngresos = document.getElementById("total-ingresos");
const totalEgresos = document.getElementById("total-egresos");

// ====== Datos guardados en el navegador ======
let movimientos = cargarMovimientos();

function cargarMovimientos() {
  const datos = localStorage.getItem(CLAVE_ALMACEN);
  if (!datos) return [];

  try {
    const guardados = JSON.parse(datos);
    return Array.isArray(guardados) ? guardados : [];
  } catch {
    // Si los datos están dañados, empezamos de cero.
    return [];
  }
}

function guardarMovimientos() {
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(movimientos));
}

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
function renderizar() {
  // Totales
  const ingresos = movimientos
    .filter((movimiento) => movimiento.tipo === "ingreso")
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);

  const egresos = movimientos
    .filter((movimiento) => movimiento.tipo === "egreso")
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);

  totalIngresos.textContent = formatearMonto(ingresos);
  totalEgresos.textContent = formatearMonto(egresos);

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
}

function plantillaMovimiento(movimiento) {
  const esIngreso = movimiento.tipo === "ingreso";
  const signo = esIngreso ? "+" : "−";
  const concepto = escaparHtml(movimiento.concepto);

  return `
    <li class="movimiento ${esIngreso ? "es-ingreso" : "es-egreso"}">
      <div class="datos">
        <p class="concepto" title="${concepto}">${concepto}</p>
        <p class="fecha">${formatearFecha(movimiento.fecha)}</p>
      </div>
      <p class="monto">${signo}${formatearMonto(movimiento.monto)}</p>
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

// ====== Registrar un movimiento ======
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

  movimientos.push({
    tipo,
    fecha,
    concepto,
    monto,
    creadoEn: Date.now(), // solo se usa para ordenar movimientos del mismo día
  });

  guardarMovimientos();
  renderizar();
  ocultarError();

  // Dejamos el formulario listo para el siguiente movimiento.
  campoConcepto.value = "";
  campoMonto.value = "";
  campoFecha.value = fechaDeHoy();
  campoConcepto.focus();
});

// ====== Arranque ======
function iniciar() {
  const hoy = fechaDeHoy();
  campoFecha.value = hoy;
  campoFecha.max = hoy; // el selector de fecha no permitirá días futuros
  renderizar();
}

iniciar();
