/* Control de entradas · Inka Fashion Perú, India Fest y Emprende Kids */
'use strict';

const API = 'https://script.google.com/macros/s/AKfycbzNQTpl4UMnX8DPNTzuEgMbdmjvNK06GRHC7STFHKR8fTZYtsqFBvA6y4d3yazzVVWc4w/exec';
// Los enlaces de las entradas siempre apuntan a la página oficial (aunque se venda desde la versión de prueba /beta/)
const APP_URL = location.origin + location.pathname.replace(/beta\/(index\.html)?$/, '');

let sesion = null;          // { clave, nombre, rol, codigo, config, precio }
let evento = null;          // evento con el que se entró (se elige cada vez al iniciar sesión)
let eventoElegido = '';     // botón marcado en la pantalla de ingreso (nunca viene marcado)
let eventosLista = [];      // eventos para la pantalla de ingreso
let vendedores = [];
let lector = null, escaneando = false, ultimoCodigo = '', ultimoTiempo = 0, temporizador = null;
let registro = { vendedor: null, qrs: [], id: '' };
let listaActual = null, misDatos = null, misFiltro = 'todas';
let entradaActual = null, plantillaPromesa = null, busquedaTimer = null;
let listaCache = null, vendedoresHora = 0;   // copias en memoria para navegar y buscar sin esperar

// ---------- Íconos ----------
const I = {
  inicio: '<path d="M3 11l9-7 9 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
  escanear: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>',
  registrar: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V9a2.5 2.5 0 0 0 0 5v1.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5V14a2.5 2.5 0 0 0 0-5z"/><path d="M12 8.5v6M9 11.5h6"/>',
  caja: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4c-.5-.9-1.5-1.4-2.6-1.4-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 1.9 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2.1-.6-2.6-1.5M12 6.5V8M12 16v1.5"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  listas: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.2"/><circle cx="4.8" cy="12" r="1.2"/><circle cx="4.8" cy="17.5" r="1.2"/>',
  mis: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V9a2.5 2.5 0 0 0 0 5v1.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5V14a2.5 2.5 0 0 0 0-5z"/><path d="M14 5v13" stroke-dasharray="2 2.5"/>',
  resumen: '<path d="M5 20v-8M11 20V5M17 20v-5M3 20h18"/>',
  respaldo: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  no: '<path d="M7 7l10 10M17 7L7 17"/>',
  alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  sorteo: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>'
};
const icono = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[n]}</svg>`;

const SECCIONES = {
  inicio: ['Inicio', 'Tu panel'],
  escanear: ['Escanear', 'Control en puerta'],
  registrar: ['Registrar', 'Anota una venta'],
  caja: ['Caja', 'Venta del día'],
  buscar: ['Buscar', 'DNI, código o nombre'],
  listas: ['Concursantes', 'Crear y ver sus entradas'],
  mis: ['Mis entradas', 'Avance de tus ventas'],
  resumen: ['Resumen', 'Totales y caja'],
  respaldo: ['Respaldo', 'Lista en tabla y PDF'],
  sorteo: ['Sortear', 'Premio entre los que ingresaron']
};
const ROLES = {
  Administrador: { pestanas: ['inicio', 'escanear', 'registrar', 'buscar'], mosaico: ['escanear', 'registrar', 'caja', 'buscar', 'listas', 'resumen', 'respaldo', 'sorteo'], inicio: 'inicio' },
  Registro: { pestanas: ['inicio', 'registrar', 'buscar', 'listas'], mosaico: ['registrar', 'buscar', 'listas', 'respaldo'], inicio: 'inicio' },
  Caja: { pestanas: ['inicio', 'caja', 'mis', 'buscar'], mosaico: ['caja', 'mis', 'buscar', 'respaldo'], inicio: 'inicio' },
  Puerta: { pestanas: [], mosaico: [], inicio: 'escanear' },
  Vendedor: { pestanas: [], mosaico: [], inicio: 'mis' }
};
const NOMBRE_ROL = { Administrador: 'Administración', Registro: 'Registro de ventas', Caja: 'Caja en puerta', Puerta: 'Control de puerta', Vendedor: 'Concursante' };

// ---------- Utilidades ----------
const $ = id => document.getElementById(id);
const jsArg = t => esc(String(t == null ? '' : t).replace(/['\\]/g, ''));
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const normal = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function aviso(texto, ms = 2600) {
  const t = $('toast'); t.textContent = texto; t.classList.add('ver');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.remove('ver'), ms);
}
function opId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
async function copiar(t) {
  try { await navigator.clipboard.writeText(t); aviso('Copiado'); } catch (e) { prompt('Copia este texto:', t); }
}
function bajar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function api(accion, datos = {}, silencioso = false) {
  if (!silencioso) $('cargando').classList.add('si');
  // Si el servidor no responde en 40 segundos, se avisa en vez de quedarse esperando para siempre
  const control = new AbortController(), plazo = setTimeout(() => control.abort(), 40000);
  try {
    const cuerpo = Object.assign({ accion, clave: sesion ? sesion.clave : '', evento: evento ? evento.clave : eventoElegido }, datos);
    const r = await fetch(API, { method: 'POST', body: JSON.stringify(cuerpo), signal: control.signal });
    const j = await r.json();
    if (j.sesion === false && sesion && sesion.nombre) { salir(); aviso('Tu clave ya no es válida. Ingresa de nuevo.'); }
    return j;
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, error: 'El servidor tardó demasiado en responder. Revisa tu internet e inténtalo otra vez.' };
    return { ok: false, error: 'Sin conexión. Revisa tu internet e inténtalo otra vez.' };
  } finally {
    clearTimeout(plazo);
    $('cargando').classList.remove('si');
  }
}

// ---------- Navegación ----------
let vistaActual = '';
function mostrar(id) {
  if (vistaActual === 'escanear' && id !== 'escanear') detenerLector();
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
  $('v-' + id).classList.add('activa');
  vistaActual = id;
  document.querySelectorAll('#pestanas button').forEach(b => b.classList.toggle('activa', b.dataset.v === id));
  window.scrollTo(0, 0);
}
async function abrir(v) {
  cerrarHoja();
  if (v === 'inicio') { pintarInicio(); mostrar('inicio'); }
  if (v === 'escanear') { mostrar('escanear'); pintarPuerta(); actualizarPuerta(); iniciarLector(); }
  if (v === 'registrar') { await cargarVendedores(); prepararRegistro(); mostrar('registrar'); }
  if (v === 'respaldo') { mostrar('respaldo'); prepararRespaldo(); }
  if (v === 'caja') { prepararCaja(); mostrar('caja'); }
  if (v === 'buscar') { mostrar('buscar'); setTimeout(() => $('bQ').focus(), 50); cargarLista().then(() => buscarEnVivo()); }
  if (v === 'listas') { await cargarVendedores(); prepararListas(); mostrar('listas'); }
  if (v === 'mis') { mostrar('mis'); cargarMis(); }
  if (v === 'resumen') { mostrar('resumen'); verResumen(); }
  if (v === 'sorteo') { prepararSorteo(); mostrar('sorteo'); }
}
// Secciones que se ven en el evento elegido (Concursantes solo existe en Inka Fashion)
const visibles = lista => lista.filter(v => v !== 'listas' || (evento && evento.concursantes));
function pintarPestanas() {
  const p = visibles(ROLES[sesion.rol].pestanas), nav = $('pestanas');
  nav.classList.toggle('oculto', !p.length);
  nav.innerHTML = p.map(v => `<button data-v="${v}" onclick="abrir('${v}')">${icono(v)}<span>${SECCIONES[v][0]}</span></button>`).join('');
}
function pintarInicio() {
  const r = ROLES[sesion.rol];
  const hora = new Date().getHours();
  $('saludo').textContent = (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + sesion.nombre.split(' ')[0];
  $('saludoRol').textContent = 'Estás en ' + evento.corto + ' como ' + NOMBRE_ROL[sesion.rol] + '.';
  // La primera tarea de cada rol va destacada; las demás, en lista
  const m = visibles(r.mosaico);
  $('mosaico').innerHTML = m.map((v, i) => `<button class="${i === 0 ? 'principal' : ''}" onclick="abrir('${v}')">${icono(v)}<div><b>${SECCIONES[v][0]}</b><span>${SECCIONES[v][1]}</span></div></button>`).join('');
  // Administración ve en el inicio si la hoja quedó en modo ensayo
  const ensayo = $('inicioEnsayo');
  ensayo.innerHTML = sesion.rol === 'Administrador' && puertaInfo && (puertaInfo.forzado || puertaInfo.forzadoInvalido) ? htmlEnsayo(puertaInfo) : '';
  ensayo.classList.toggle('oculto', !ensayo.innerHTML);
  if (sesion.rol === 'Administrador') cifrasInicio();
}
async function cifrasInicio() {
  const r = await api('resumen', {}, true);
  if (!r.ok) return;
  const s = r.resumen, c = $('cifrasInicio');
  c.innerHTML = [[s.total - s.anulada, 'Entradas'], [s.entregada + s.usada, 'Con comprador'], [s.usada, 'Ingresaron']]
    .map(x => `<div class="cifra vidrio"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
  c.classList.remove('oculto');
}

// ---------- Sesión ----------
// Pantalla de ingreso: el evento se elige SIEMPRE, ningún botón viene marcado
const EVENTOS_RESPALDO = [
  { clave: 'INKA', corto: 'Inka Fashion', marca: 'Inka Fashion Perú', color: '#E2B657', fechaTexto: 'domingo 31 de enero', horario: '11:00 a.m. a 8:00 p.m.' },
  { clave: 'INDIA', corto: 'India Fest', marca: 'Expomundo', color: '#C8102E', fechaTexto: 'sábado 30 de enero', horario: '3:00 p.m. a 8:00 p.m.' },
  { clave: 'KIDS', corto: 'Emprende Kids', marca: 'Emprende Kids y Teens', color: '#1E9E5A', fechaTexto: 'sábado 30 de enero', horario: '9:00 a.m. a 1:00 p.m.' }
];
async function cargarEventosLogin() {
  if (!eventosLista.length) {
    pintarEventosLogin(EVENTOS_RESPALDO);
    const r = await api('eventos', {}, true);
    eventosLista = r.ok && r.eventos.length ? r.eventos : EVENTOS_RESPALDO;
  }
  pintarEventosLogin(eventosLista);
}
function pintarEventosLogin(lista) {
  $('eventosLogin').innerHTML = lista.map(e => `<button type="button" class="ev-opcion${eventoElegido === e.clave ? ' sel' : ''}" style="--c:${esc(e.color)}" aria-pressed="${eventoElegido === e.clave}" onclick="elegirEventoLogin('${jsArg(e.clave)}')">
    <i aria-hidden="true"></i><span><b>${esc(e.corto)}</b><small>${esc(e.fechaTexto)}, de ${esc(e.horario)}</small></span></button>`).join('');
}
function elegirEventoLogin(clave) {
  eventoElegido = clave;
  $('loginError').textContent = '';
  pintarEventosLogin(eventosLista.length ? eventosLista : EVENTOS_RESPALDO);
  const c = $('clave'); if (!c.value) c.focus();
}
function pantallaIngreso(mensaje) {
  eventoElegido = '';
  try { $('clave').value = localStorage.getItem('clave') || ''; } catch (e) {}
  $('loginError').textContent = mensaje || '';
  mostrar('login');
  cargarEventosLogin();
}
async function entrar() {
  const clave = $('clave').value.trim(), err = $('loginError');
  err.textContent = '';
  if (!eventoElegido) { err.textContent = 'Primero elige el evento'; return; }
  if (!clave) { err.textContent = 'Escribe tu clave'; return; }
  sesion = { clave };
  evento = null;
  const r = await api('login');
  if (!r.ok) { sesion = null; err.textContent = r.error; return; }
  iniciarSesion(clave, r);
}
function iniciarSesion(clave, r) {
  sesion = { clave, nombre: r.nombre, rol: r.rol, codigo: r.codigo || '', config: r.config };
  evento = r.evento;
  eventoElegido = '';
  puertaInfo = r.puerta || null;
  desfase = r.ahora ? r.ahora - Date.now() : 0;
  plantillas = {};
  try { localStorage.setItem('clave', clave); } catch (e) {}
  $('clave').value = '';
  $('avatar').textContent = sesion.nombre.trim().charAt(0).toUpperCase();
  $('avatar').classList.remove('oculto');
  $('menuNombre').textContent = sesion.nombre;
  $('menuRol').textContent = NOMBRE_ROL[sesion.rol] || sesion.rol;
  $('subtituloMarca').textContent = NOMBRE_ROL[sesion.rol] || 'Control de entradas';
  pintarBandaEvento();
  pintarPestanas();
  abrir(ROLES[sesion.rol].inicio);
  // Deja listos el diseño de la entrada y la letra para que la primera entrada salga al instante
  if (sesion.rol !== 'Puerta') setTimeout(() => { cargarPlantilla().catch(() => {}); try { document.fonts.load('700 40px Montserrat'); } catch (e) {} }, 1500);
}
// Franja arriba con el evento elegido: siempre visible dentro de la app
// Letra negra o blanca, la que se lea mejor sobre el color del evento
function tintaSobre(color) {
  const h = String(color || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#FFFFFF';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#16181C' : '#FFFFFF';
}
function pintarBandaEvento() {
  const b = $('bandaEvento'), raiz = document.documentElement.style, meta = document.querySelector('meta[name=theme-color]');
  if (!evento) { b.classList.add('oculto'); raiz.removeProperty('--ev'); raiz.removeProperty('--ev-tinta'); if (meta) meta.content = '#FFFFFF'; return; }
  raiz.setProperty('--ev', evento.color);
  raiz.setProperty('--ev-tinta', tintaSobre(evento.color));
  if (meta) meta.content = evento.color;   // la barra del celular toma el color del evento
  $('bandaNombre').textContent = evento.corto;
  $('bandaDetalle').textContent = evento.fechaTexto + ', de ' + evento.horario;
  b.classList.remove('oculto');
  document.title = evento.corto + ' · Entradas';
  pintarEstadoBanda();
}
// ¿El evento elegido está en horario, ya terminó o todavía no empieza? (hora de Lima, según el servidor)
let desfase = 0;   // diferencia entre la hora del servidor y la del celular
function estadoEvento(ev) {
  if (!ev || !ev.fecha || !ev.inicio || !ev.fin) return '';
  const hm = h => ('0' + h).slice(-5);
  const ini = new Date(ev.fecha + 'T' + hm(ev.inicio) + ':00-05:00').getTime();
  const fin = new Date(ev.fecha + 'T' + hm(ev.fin) + ':00-05:00').getTime();
  const ahora = Date.now() + desfase;
  if (ahora > fin) return 'terminado';
  if (ahora >= ini - (Number(ev.tolerancia) || 0) * 60000) return 'encurso';
  return 'antes';
}
// En la franja: "En horario ahora" o, si ya terminó, el aviso para cambiar de evento (la puerta no lo necesita: decide por la hora)
function pintarEstadoBanda() {
  const s = $('bandaEstado');
  const e = evento && sesion && sesion.rol !== 'Puerta' ? estadoEvento(evento) : '';
  s.className = 'banda-estado' + (e === 'terminado' ? ' fin' : e === 'encurso' ? ' vivo' : ' oculto');
  s.textContent = e === 'terminado' ? 'Ya terminó: toca Cambiar evento' : e === 'encurso' ? 'En horario ahora' : '';
}
setInterval(() => { if (evento) pintarEstadoBanda(); }, 60000);

// ---------- Qué acepta la puerta ahora (arriba del escáner) ----------
let puertaInfo = null;
function htmlEnsayo(p) {
  let h = '';
  if (p.forzado) h += `<div class="ep ensayo"><b>Modo ensayo activado</b><span>Solo pasan entradas de ${esc(p.forzado.corto)}, sin mirar la hora. Antes del evento, borra "Evento activo forzado" en la pestaña Configuración de la hoja.</span></div>`;
  if (p.forzadoInvalido) h += `<div class="ep ensayo"><span>En Configuración, "Evento activo forzado" dice "${esc(p.forzadoInvalido)}", que no es un evento: se ignora y la puerta usa la hora. Escribe INKA, INDIA o KIDS, o déjalo vacío.</span></div>`;
  return h;
}
function pintarPuerta(p) {
  if (p) puertaInfo = p;
  p = puertaInfo;
  const c = $('estadoPuerta');
  if (!p) { c.classList.add('oculto'); return; }
  let h = htmlEnsayo(p);
  if (!p.forzado) {
    h += p.activos.length
      ? p.activos.map(a => `<div class="ep" style="--c:${esc(a.color)}"><i aria-hidden="true"></i><span>Ahora pasan las entradas de <b>${esc(a.corto)}</b>, hasta las ${esc(a.hasta)}.</span></div>`).join('')
      : `<div class="ep nada"><span>Ahora ningún evento está en horario: toda entrada será rechazada.${p.proximo ? ` Próximo: <b>${esc(p.proximo.corto)}</b>, ${esc(p.proximo.fechaTexto)}, desde las ${esc(p.proximo.abre)}.` : ''}</span></div>`;
  }
  c.innerHTML = h;
  c.classList.remove('oculto');
}
async function actualizarPuerta() { const r = await api('puerta', {}, true); if (r.ok) pintarPuerta(r.puerta); }
setInterval(() => { if (sesion && vistaActual === 'escanear') actualizarPuerta(); }, 300000);

function cerrarSesionLocal() {
  listaCache = null; vendedores = []; vendedoresHora = 0; misDatos = null; listaActual = null; envio = null;
  puertaInfo = null; rpEvento = ''; rpDatos = null; ventaActual = null;
  detenerLector();
  cerrarHoja();
  sesion = null;
  evento = null;
  pintarBandaEvento();
  $('avatar').classList.add('oculto');
  $('menuUsuario').classList.add('oculto');
  $('pestanas').classList.add('oculto');
  $('subtituloMarca').textContent = 'Control de entradas';
}
function cambiarEvento() {
  if (!confirm('Estás en ' + evento.corto + '. ¿Quieres salir de este evento y elegir otro?')) return;
  cerrarSesionLocal();
  pantallaIngreso('Elige el evento y vuelve a entrar.');
}
function salir() {
  cerrarSesionLocal();
  try { localStorage.removeItem('clave'); } catch (e) {}
  pantallaIngreso();
}
function alternarMenu() {
  const m = $('menuUsuario'), abierto = m.classList.toggle('oculto');
  $('avatar').setAttribute('aria-expanded', String(!abierto));
}
document.addEventListener('click', e => {
  if (!e.target.closest('#menuUsuario') && !e.target.closest('#avatar')) $('menuUsuario').classList.add('oculto');
});

// ---------- Buscador con lista (se puede escribir) ----------
function combo(contenedor, items, opciones) {
  const cont = $(contenedor);
  const placeholder = opciones.placeholder || 'Escribe para buscar';
  function vacio() {
    cont.innerHTML = `<div class="combo"><input type="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-autocomplete="list"><div class="opciones oculto" role="listbox"></div></div>`;
    const input = cont.querySelector('input'), lista = cont.querySelector('.opciones');
    let activo = 0, filtrados = [];
    function pintar() {
      const q = normal(input.value);
      filtrados = items.filter(it => !q || normal(it.label + ' ' + (it.sub || '') + ' ' + it.value).includes(q)).slice(0, 60);
      activo = 0;
      lista.innerHTML = filtrados.length
        ? filtrados.map((it, i) => `<button type="button" class="opcion" role="option" data-i="${i}" aria-selected="${i === 0}">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')
        : '<div class="vacio">Sin coincidencias</div>';
      lista.classList.remove('oculto');
    }
    function marcar() { lista.querySelectorAll('.opcion').forEach((b, i) => b.setAttribute('aria-selected', String(i === activo))); }
    input.addEventListener('focus', pintar);
    input.addEventListener('input', pintar);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { activo = Math.min(activo + 1, filtrados.length - 1); marcar(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { activo = Math.max(activo - 1, 0); marcar(); e.preventDefault(); }
      if (e.key === 'Enter' && filtrados[activo]) { elegir(filtrados[activo]); e.preventDefault(); }
      if (e.key === 'Escape') lista.classList.add('oculto');
    });
    input.addEventListener('blur', () => setTimeout(() => lista.classList.add('oculto'), 180));
    lista.addEventListener('mousedown', e => e.preventDefault());
    lista.addEventListener('click', e => { const b = e.target.closest('.opcion'); if (b) elegir(filtrados[Number(b.dataset.i)]); });
    if (opciones.enfocar) setTimeout(() => input.focus(), 60);
  }
  function elegir(it) {
    cont.innerHTML = `<div class="elegido"><div><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div><button type="button">Cambiar</button></div>`;
    cont.querySelector('button').onclick = () => { vacio(); opciones.alLimpiar && opciones.alLimpiar(); cont.querySelector('input').focus(); };
    opciones.alElegir(it);
  }
  vacio();
}

// ---------- Formularios de comprador y pago ----------
// En Emprende Kids se registra al padre, la madre o el apoderado (los niños no se registran)
const esApoderado = () => !!(evento && /apoderado/i.test(evento.etiquetaComprador || ''));
function htmlComprador(p) {
  const apo = esApoderado();
  return `
    ${apo ? '<p class="nota" style="margin-top:-4px">Registra al padre, la madre o el apoderado. Los niños no se registran.</p>' : ''}
    <label for="${p}Nombre">${apo ? 'Nombre del padre, madre o apoderado' : 'Nombre completo'}</label>
    <input type="text" id="${p}Nombre" autocomplete="off" autocapitalize="words" placeholder="Como figura en su documento">
    <div class="dos">
      <div><label for="${p}TipoDoc">${apo ? 'Documento del adulto' : 'Documento'}</label>
        <select id="${p}TipoDoc"><option>DNI</option><option>Carnet de extranjería</option><option>Pasaporte</option></select></div>
      <div><label for="${p}Doc">Número</label><input type="text" id="${p}Doc" inputmode="numeric" autocomplete="off"></div>
    </div>
    <label for="${p}Cel">${apo ? 'Celular del adulto (con WhatsApp)' : 'Celular con WhatsApp'}</label>
    <input type="tel" id="${p}Cel" inputmode="numeric" maxlength="9" placeholder="9XX XXX XXX">
    ${apo ? '' : '<p class="nota">Para menores de edad, usa el DNI del adulto que lo acompaña.</p>'}`;
}
// Precio: una sola casilla obligatoria, vacía al empezar. Se escribe el precio al que se vendió.
// Con cantidad (caja y ventas de la organización): de 1 a 10 entradas con los mismos datos; el precio es por entrada.
function htmlPago(p, conRegalo, conCantidad) {
  const metodos = ['Efectivo', 'Yape', 'Plin', 'Transferencia'].concat(conRegalo ? ['Regalo'] : []);
  return `
    ${conCantidad ? `<span class="etiqueta" style="margin-top:0">Cantidad de entradas</span>
    <div class="contador"><button type="button" onclick="cambiarCantidad('${p}', -1)" aria-label="Una entrada menos">−</button><output id="${p}Cant" aria-live="polite">1</output><button type="button" onclick="cambiarCantidad('${p}', 1)" aria-label="Una entrada más">+</button></div>` : ''}
    <div class="dos">
      <div><label for="${p}Monto">${conCantidad ? 'Precio por entrada (S/)' : 'Precio de venta (S/)'}</label>
        <input type="text" id="${p}Monto" inputmode="decimal" autocomplete="off" placeholder="Escribe el precio" value=""${conCantidad ? ` oninput="totalVenta('${p}')"` : ''}></div>
      <div id="${p}OperBloque" class="oculto"><label for="${p}Oper">Código de operación</label>
        <input type="text" id="${p}Oper" inputmode="numeric" autocomplete="off" placeholder="Del comprobante"></div>
    </div>
    ${conCantidad ? `<p class="total-venta oculto" id="${p}Total" aria-live="polite"></p>` : ''}
    <span class="etiqueta">Método de pago</span>
    <div class="segmentos" id="${p}Metodos">${metodos.map(m => `<button type="button" data-m="${m}" onclick="elegirMetodo('${p}', this)">${m}</button>`).join('')}</div>`;
}
const redondear = x => Math.round(x * 100) / 100;
function cambiarCantidad(p, paso) {
  const o = $(p + 'Cant');
  o.textContent = Math.min(10, Math.max(1, (Number(o.textContent) || 1) + paso));
  totalVenta(p);
}
// Con 2 o más entradas muestra el total a cobrar
function totalVenta(p) {
  const t = $(p + 'Total');
  if (!t) return;
  const n = Number($(p + 'Cant').textContent) || 1, m = $(p + 'Monto').value;
  t.textContent = n < 2 ? '' : precioValido(m) ? `Total a cobrar: S/ ${redondear(n * Number(String(m).trim().replace(',', '.')))} por ${n} entradas` : `${n} entradas: escribe el precio de cada una`;
  t.classList.toggle('oculto', n < 2);
}
function elegirMetodo(p, b) {
  document.querySelectorAll('#' + p + 'Metodos button').forEach(x => x.classList.remove('sel'));
  b.classList.add('sel');
  const m = b.dataset.m === 'Regalo' ? 'Regalo (sin pago)' : b.dataset.m;
  $(p + 'Metodos').dataset.valor = m;
  $(p + 'OperBloque').classList.toggle('oculto', !['Yape', 'Plin', 'Transferencia'].includes(m));
  const monto = $(p + 'Monto');
  if (m === 'Regalo (sin pago)') { monto.value = '0'; monto.readOnly = true; }
  else if (monto.readOnly) { monto.readOnly = false; monto.value = ''; }
}
// Precio válido: número mayor que 0, con punto o coma decimal
function precioValido(t) {
  t = String(t || '').trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) && Number(t) > 0 && Number(t) <= 1000;
}
function leerComprador(p) {
  return { nombre: $(p + 'Nombre').value, tipoDoc: $(p + 'TipoDoc').value, doc: $(p + 'Doc').value, celular: $(p + 'Cel').value };
}
function leerPago(p) {
  const cant = $(p + 'Cant');
  return { metodo: $(p + 'Metodos').dataset.valor || '', operacion: $(p + 'Oper').value, monto: $(p + 'Monto').value, cantidad: cant ? Number(cant.textContent) || 1 : 1 };
}
function validarLocal(d) {
  if ((d.nombre || '').trim().length < 3) return 'Escribe el nombre completo';
  if (!d.doc.trim()) return 'Escribe el número de documento';
  if (d.tipoDoc === 'DNI' && !/^\d{8}$/.test(d.doc.trim())) return 'El DNI debe tener 8 números';
  if (!/^9\d{8}$/.test(d.celular.replace(/\D/g, ''))) return 'El celular debe tener 9 números y empezar con 9';
  if (d.metodo !== 'Regalo (sin pago)' && !precioValido(d.monto)) return 'Escribe el precio de venta: un número mayor que 0';
  if (!d.metodo) return 'Elige el método de pago';
  if (['Yape', 'Plin', 'Transferencia'].includes(d.metodo) && !d.operacion.trim()) return 'Escribe el código de operación';
  return '';
}

// ---------- Registrar ----------
// Vendedores: se piden una vez y se reutilizan 5 minutos (se refrescan al crear un concursante)
async function cargarVendedores(forzar) {
  if (!forzar && vendedores.length && Date.now() - vendedoresHora < 300000) return;
  const r = await api('vendedores', {}, vendedores.length > 0);
  if (r.ok) { vendedores = r.vendedores; sesion.precio = r.precio; vendedoresHora = Date.now(); }
}
// Lista de entradas asignadas: alimenta la búsqueda instantánea y la lista de respaldo
async function cargarLista(forzar) {
  if (!forzar && listaCache && Date.now() - listaCache.t < 60000) return listaCache;
  const r = await api('lista', {}, true);
  if (r.ok) listaCache = { filas: r.filas, otros: new Set(r.otros || []), hora: r.hora, t: Date.now() };
  else if (!listaCache) aviso(r.error);
  return listaCache;
}
const normId = t => String(t || '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I');
const aEntrada = f => ({ id: f[0], nLista: f[1], comprador: f[2], doc: f[3], celular: f[4], vendedor: f[5], estado: f[6], horaIngreso: f[7] });
function filtrarLista(q, fuente = listaCache) {
  if (!fuente) return [];
  const t = normal(q), d = q.toUpperCase().replace(/\s+/g, ''), k = normId(d);
  return fuente.filas.filter(f => normId(f[0]).includes(k) || (d.length >= 4 && (f[3].toUpperCase().includes(d) || f[4].includes(d))) || normal(f[2]).includes(t));
}
function prepararRegistro() {
  registro = { vendedor: null, qrs: [], id: '' };
  $('bloqueQR').classList.add('oculto');
  $('rDatos').classList.add('oculto');
  $('rError').textContent = '';
  $('btnRegistrar').dataset.op = opId();
  // En eventos sin concursantes (India Fest, Emprende Kids) solo vende la organización
  const items = vendedores.filter(v => v.codigo !== 'CAJA' && (evento.concursantes || v.tipo !== 'Concursante'))
    .map(v => ({ value: v.codigo, label: v.nombre, sub: v.tipo + ' · ' + v.codigo, v }));
  combo('rVendedor', items, {
    placeholder: 'Escribe un nombre',
    alElegir: it => elegirVendedor(it.v),
    alLimpiar: () => { registro.vendedor = null; $('bloqueQR').classList.add('oculto'); $('rDatos').classList.add('oculto'); }
  });
}
async function elegirVendedor(v) {
  registro.vendedor = v; registro.id = '';
  const esConc = v.tipo === 'Concursante';
  $('bloqueComprador').innerHTML = htmlComprador('r');
  $('bloquePago').innerHTML = esConc
    ? '<p class="nota" style="margin-top:-4px">Lo que pagó el comprador al concursante. Si fue un regalo, elige Regalo.</p>' + htmlPago('r', true)
    : htmlPago('r', false, true);
  $('rDatos').classList.remove('oculto');
  $('bloqueQR').classList.toggle('oculto', !esConc);
  if (esConc) {
    $('rFiltroQR').value = '';
    $('rFichas').innerHTML = '<p class="nota">Cargando sus entradas...</p>';
    const r = await api('listaConcursante', { codigo: v.codigo });
    registro.qrs = r.ok ? r.qrs.sort((a, b) => Number(a.n) - Number(b.n)) : [];
    pintarFichas();
  }
}
function pintarFichas() {
  const q = normal($('rFiltroQR').value);
  const lista = registro.qrs.filter(x => !q || String(x.n) === q || normal(x.id).includes(q));
  $('rFichas').innerHTML = lista.length ? lista.map(x => {
    const ocupada = !!x.comprador, clase = x.estado === 'Usada' ? 'usada' : ocupada ? 'registrada' : 'libre';
    const sel = registro.id === x.id ? ' sel' : '';
    return `<button type="button" class="ficha ${clase}${sel}" ${ocupada ? 'disabled' : ''} onclick="elegirFicha('${jsArg(x.id)}')" aria-label="Entrada ${x.n}${ocupada ? ', ya registrada a ' + esc(x.comprador) : ''}">${esc(x.n)}<small>${x.id.slice(0, 4)}</small></button>`;
  }).join('') : '<p class="nota">No hay entradas que coincidan.</p>';
}
function elegirFicha(id) {
  registro.id = id;
  pintarFichas();
  const x = registro.qrs.find(q => q.id === id);
  aviso('Entrada N° ' + x.n + ' elegida');
  $('rNombre').focus({ preventScroll: true });
  $('rDatos').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function registrar() {
  const err = $('rError'); err.textContent = '';
  const v = registro.vendedor;
  if (!v) { err.textContent = 'Elige quién vendió'; return; }
  const esConc = v.tipo === 'Concursante';
  const d = Object.assign({ vendedor: v.codigo }, leerComprador('r'), leerPago('r'));
  if (esConc) { d.id = registro.id; if (!d.id) { err.textContent = 'Elige cuál de sus entradas entregó'; return; } }
  const e = validarLocal(d);
  if (e) { err.textContent = e; if (/precio/.test(e)) $('rMonto').focus(); return; }
  const btn = $('btnRegistrar'); d.opId = btn.dataset.op; btn.disabled = true;
  const r = await api('registrar', d);
  btn.disabled = false;
  if (!r.ok) { err.textContent = r.error; return; }
  const n = r.cantidad || 1, total = redondear(n * Number(String(d.monto).trim().replace(',', '.')));
  hecho(r.id, d.nombre, d.celular, esConc ? `Entrada N° ${r.numero} de ${v.nombre}`
    : n > 1 ? `Venta de ${v.nombre} · ${n} entradas · S/ ${total} en total` : `Venta de ${v.nombre} · S/ ${d.monto}`, () => abrir('registrar'), r.numero, r.entradas);
}

// ---------- Caja ----------
function prepararCaja() {
  $('bloqueCompradorCaja').innerHTML = htmlComprador('c');
  $('bloquePagoCaja').innerHTML = htmlPago('c', false, true);
  $('btnCaja').textContent = 'Cobrar y registrar';
  $('cError').textContent = '';
  $('cIngresa').checked = true;
  $('btnCaja').dataset.op = opId();
}
async function venderCaja() {
  const err = $('cError'); err.textContent = '';
  const d = Object.assign({}, leerComprador('c'), leerPago('c'));
  const e = validarLocal(d);
  if (e) { err.textContent = e; if (/precio/.test(e)) $('cMonto').focus(); return; }
  d.ingresaAhora = $('cIngresa').checked;
  const btn = $('btnCaja'); d.opId = btn.dataset.op; btn.disabled = true;
  const r = await api('venderPuerta', d);
  btn.disabled = false;
  if (!r.ok) { err.textContent = r.error; return; }
  const n = r.cantidad || 1, varias = n > 1;
  const cobro = varias ? `Cobrado S/ ${r.total} por ${n} entradas con ${d.metodo}. ` : `Cobrado S/ ${r.monto} con ${d.metodo}. `;
  hecho(r.id, d.nombre, d.celular, cobro + (r.ingreso ? (varias ? 'Ya pueden pasar: ponles el sello.' : 'Ya puede pasar: ponle el sello.') : (varias ? 'Deben pasar por el escáner.' : 'Debe pasar por el escáner.')), () => abrir('caja'), r.numero, r.entradas);
}

// ---------- Venta completada ----------
let ventaActual = null;   // entradas de la última venta: { entradas: [{id, numero}], nombre }
// Mensaje al comprador: el texto de la pestaña Eventos, con su nombre y el enlace de cada entrada
function mensajeComprador(nombre, links) {
  const n = links.length;
  let saludo = (evento.msgComprador || 'Hola [nombre], esta es tu entrada para ' + evento.nombre + ':')
    .replace(/\[nombre\]/gi, nombre.trim().split(' ')[0]).replace(/\[cantidad\]/gi, n);
  if (n === 1) return `${saludo}\n${links[0]}\nMuéstrala en la puerta. Cada QR sirve para un solo ingreso.`;
  saludo = saludo.replace(/esta es tu entrada/i, `estas son tus ${n} entradas`).replace(/está tu entrada/i, `están tus ${n} entradas`).replace(/tu entrada/i, `tus ${n} entradas`);
  return `${saludo}\n${links.map((l, i) => `${i + 1}) ${l}`).join('\n')}\nUna entrada por persona. Muéstralas en la puerta: cada QR sirve para un solo ingreso.`;
}
function hecho(id, nombre, cel, texto, otra, n, entradas) {
  const lista = entradas && entradas.length ? entradas : [{ id, numero: n }];
  cel = String(cel || '').replace(/\D/g, '');
  ventaActual = { entradas: lista, nombre };
  $('hTitulo').textContent = lista.length > 1 ? lista.length + ' entradas registradas' : 'Entrada registrada';
  $('hTexto').textContent = texto;
  $('hCodigo').textContent = id;
  $('hDiseno').innerHTML = '<div class="esperando">Preparando la entrada...</div>';
  // Con varias entradas: la lista de todas, cada una con su botón para verla
  $('hLista').innerHTML = lista.length > 1 ? lista.map(x => `<li><div class="item-cab"><div><b>Entrada N° ${esc(x.numero)}</b><small class="mono">${esc(x.id)}</small></div>
    <div class="item-acciones" style="margin:0"><button onclick="verEntradaEnHoja('${jsArg(x.id)}','Entrada N° ${jsArg(x.numero)}','${jsArg(cel)}','${jsArg(nombre)}','${jsArg(x.numero)}')">Ver</button></div></div></li>`).join('') : '';
  $('hPanelLista').classList.toggle('oculto', lista.length < 2);
  $('hCompartir').lastChild.textContent = lista.length > 1 ? 'Enviar las ' + lista.length + ' imágenes por WhatsApp' : 'Enviar imagen por WhatsApp';
  const msg = mensajeComprador(nombre, lista.map(x => APP_URL + '?t=' + x.id));
  $('hWhats').href = 'https://wa.me/51' + cel.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
  $('hWhats').textContent = lista.length > 1 ? 'Enviar los ' + lista.length + ' enlaces por WhatsApp' : 'Enviar el enlace por WhatsApp';
  $('hOtra').onclick = otra;
  mostrar('hecho');
  mostrarDiseno('hDiseno', id, n);
}
// Comparte la imagen de la entrada o, si la venta fue de varias, todas juntas
async function compartirVenta() {
  const v = ventaActual;
  if (!v || v.entradas.length < 2) return compartirEntrada();
  aviso('Preparando ' + v.entradas.length + ' imágenes...', 5000);
  try {
    const archivos = [];
    for (const x of v.entradas) {
      const cv = await crearEntrada(x.id, x.numero);
      const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.9));
      archivos.push(new File([blob], 'Entrada_' + String(x.numero).padStart(2, '0') + '_' + x.id + '.jpg', { type: 'image/jpeg' }));
    }
    if (navigator.canShare && navigator.canShare({ files: archivos })) {
      try { await navigator.share({ files: archivos, title: 'Entradas' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    archivos.forEach((f, i) => setTimeout(() => bajar(f, f.name), i * 400));
  } catch (e) {
    aviso('No se pudieron preparar las imágenes: ' + e.message, 5000);
  }
}

// ---------- Escáner ----------
function iniciarLector() {
  $('avisoCamara').classList.add('oculto');
  if (lector) { try { lector.resume(); } catch (e) {} escaneando = true; return; }
  if (typeof Html5Qrcode === 'undefined') {
    $('avisoCamara').textContent = 'No se pudo cargar el lector. Revisa tu internet y recarga la página, o escribe el código a mano.';
    $('avisoCamara').classList.remove('oculto'); return;
  }
  lector = new Html5Qrcode('lector');
  lector.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.68); return { width: s, height: s }; } }, alLeer, () => {})
    .then(() => { escaneando = true; })
    .catch(() => {
      lector = null;
      $('avisoCamara').textContent = 'No se pudo abrir la cámara. Da permiso al navegador para usarla, o escribe el código a mano.';
      $('avisoCamara').classList.remove('oculto');
    });
}
function detenerLector() {
  clearTimeout(temporizador);
  escaneando = false;
  if (lector) { const l = lector; lector = null; l.stop().catch(() => {}).finally(() => { try { l.clear(); } catch (e) {} }); }
}
function alLeer(texto) {
  if (!escaneando) return;
  const ahora = Date.now();
  if (texto === ultimoCodigo && ahora - ultimoTiempo < 4000) return;
  ultimoCodigo = texto; ultimoTiempo = ahora;
  escaneando = false;
  try { lector.pause(true); } catch (e) {}
  validar(texto);
}
function validarManual() {
  const c = $('codigoManual').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 10) { aviso('El código tiene 10 caracteres'); return; }
  escaneando = false;
  try { lector && lector.pause(true); } catch (e) {}
  $('codigoManual').value = '';
  validar(c);
}
async function validar(codigo) {
  abrirHoja('aviso', `<div class="veredicto"><div class="sello">${icono('escanear')}</div><div><h2>Validando</h2><p>${esc(codigo)}</p></div></div>`);
  const r = await api('escanear', { id: codigo }, true);
  if (r.puerta) pintarPuerta(r.puerta);
  const filas = pares => '<div class="datos">' + pares.filter(p => p[1]).map(p => `<div class="dato"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('') + '</div>';
  const siguiente = '<button class="btn btn-vidrio" onclick="siguienteEscaneo()">Escanear siguiente</button>';
  if (!r.ok) {
    abrirHoja('aviso', `<div class="veredicto"><div class="sello">${icono('alerta')}</div><div><h2>Sin respuesta</h2><p>${esc(r.error)}</p></div></div>${siguiente}`);
    sonido(false); return;
  }
  const vend = r.vendedor ? r.vendedor + (r.tipoVendedor === 'Concursante' ? ' · concursante' + (r.nLista ? ', N° ' + r.nLista : '') : ' · organización') : '';
  const comunes = [['Comprador', r.comprador], [r.tipoDoc || 'Documento', r.doc], ['Vendió', vend], ['N.º', r.nLista], ['Registrada', r.fechaRegistro], ['Escaneada', r.horaEscaneo], ['Código', r.id]];
  // Nombre del evento de la entrada, en grande y con su color
  const colorEv = r.eventoColor || '#E2B657';
  const evGrande = r.eventoNombre ? `<div class="ev-grande" style="--c:${esc(colorEv)};--ct:${tintaSobre(colorEv)}">${esc(r.eventoNombre)}</div>` : '';
  if (r.resultado === 'Válido') {
    abrirHoja('ok', `<div class="veredicto"><div class="sello">${icono('ok', 'stroke-width="2.6"')}</div><div><h2>Puede pasar</h2><p>${r.sinDatos ? 'Concursante sin datos del comprador: pide su DNI si puedes.' : 'Ponle el sello en el brazo.'}</p></div></div>${evGrande}${filas(comunes)}${siguiente}`);
    sonido(true);
    temporizador = setTimeout(siguienteEscaneo, 3500);
  } else if (r.resultado === 'Otro evento') {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('no', 'stroke-width="2.6"')}</div><div><h2>No es de este horario</h2><p>${esc(r.mensaje)}</p></div></div>${evGrande}${filas(comunes)}<p class="nota" style="color:rgba(255,255,255,.85)">Una entrada solo sirve para su evento. No la dejes pasar.</p>${siguiente}`);
    sonido(false);
  } else if (r.resultado === 'Ya usado') {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('no', 'stroke-width="2.6"')}</div><div><h2>Ya fue usada</h2><p>Ingresó ${r.hace ? '<b>' + esc(r.hace) + '</b> (' + esc(r.horaIngreso) + ')' : esc(r.horaIngreso)} · escaneó ${esc(r.escaneadoPor)}</p></div></div>${evGrande}${filas(comunes)}<p class="nota" style="color:rgba(255,255,255,.8)">Si tiene sello, es un reingreso. Si no, llama al supervisor.</p>${siguiente}`);
    sonido(false);
  } else if (r.resultado === 'Anulado') {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('no', 'stroke-width="2.6"')}</div><div><h2>Entrada anulada</h2><p>Deriva al supervisor.</p></div></div>${evGrande}${filas(comunes.concat([['Motivo', r.obs]]))}${siguiente}`);
    sonido(false);
  } else {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('alerta')}</div><div><h2>No existe</h2><p>${r.reserva ? 'Este código todavía no fue vendido a nadie.' : 'Este código no está registrado.'} Deriva a caja o al supervisor.</p></div></div>${filas([['Leído', r.id], ['Escaneada', r.horaEscaneo]])}${siguiente}`);
    sonido(false);
  }
}
function siguienteEscaneo() {
  clearTimeout(temporizador);
  cerrarHoja();
  if (lector) { try { lector.resume(); } catch (e) {} }
  escaneando = true;
}
function sonido(bien) {
  try {
    if (navigator.vibrate) navigator.vibrate(bien ? 120 : [250, 100, 250]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = bien ? 880 : 220; o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + (bien ? 0.15 : 0.5));
  } catch (e) {}
}

// ---------- Hoja inferior ----------
function abrirHoja(tono, html) {
  const h = $('hoja');
  h.className = 'hoja abierta ' + (tono || '');
  $('hojaContenido').innerHTML = html;
  $('velo').classList.add('abierto');
}
function cerrarHoja() {
  $('hoja').className = 'hoja';
  $('velo').classList.remove('abierto');
  if (vistaActual === 'escanear' && !escaneando && lector) { try { lector.resume(); } catch (e) {} escaneando = true; clearTimeout(temporizador); }
}
async function verEntradaEnHoja(id, titulo, cel, nombre, n) {
  abrirHoja('', `<h2 style="margin-top:0">${esc(titulo)}</h2><div id="hojaDiseno" class="disenio"><div class="esperando">Preparando la entrada...</div></div><div class="codigo">${esc(id)}</div>
    <button class="btn btn-oro" onclick="compartirEntrada()">Guardar o compartir</button>
    <div class="fila-btn"><button class="btn btn-vidrio" onclick="descargarPNG()">Imagen PNG</button><button class="btn btn-vidrio" onclick="descargarPDF()">Archivo PDF</button></div>
    ${cel ? `<button class="btn btn-vidrio" onclick="reenviar('${jsArg(id)}','${jsArg(nombre)}','${jsArg(cel)}')">Enviar el enlace por WhatsApp</button>` : ''}
    <button class="btn btn-vidrio" onclick="cerrarHoja()">Cerrar</button>`);
  mostrarDiseno('hojaDiseno', id, n);
}

// ---------- Buscar ----------
function buscarEnVivo() {
  const q = $('bQ').value.trim();
  if (q.length < 3) { $('bEstado').textContent = 'Escribe al menos 3 caracteres.'; $('bPanel').classList.add('oculto'); return; }
  if (!listaCache) { $('bEstado').textContent = 'Cargando entradas...'; cargarLista().then(() => listaCache && buscarEnVivo()); return; }
  buscar();
}
// Filtra en el celular, sin esperar al servidor
function buscar() {
  const q = $('bQ').value.trim();
  if (q.length < 3) return;
  const todos = filtrarLista(q), res = todos.slice(0, 50).map(aEntrada);
  const doc = q.toUpperCase().replace(/\s+/g, '');
  const enOtro = !todos.length && listaCache.otros && listaCache.otros.has(doc);
  $('bEstado').innerHTML = (todos.length ? todos.length + ' resultado' + (todos.length > 1 ? 's' : '') + (todos.length > 50 ? ' (se muestran 50)' : '')
    : enOtro ? '<b class="aviso-otro">Este DNI tiene entradas en otro evento.</b> Aquí solo se ven las de ' + esc(evento.corto) + '.'
    : 'Sin resultados para "' + esc(q) + '" en ' + esc(evento.corto) + '.') +
    ` · datos de las ${esc(listaCache.hora.slice(-5))} <button type="button" class="enlace" onclick="actualizarBusqueda()">Actualizar</button>`;
  $('bPanel').classList.toggle('oculto', !res.length);
  const admin = sesion.rol === 'Administrador';
  $('bResultados').innerHTML = res.map(x => `
    <li>
      <div class="item-cab"><div><b>${esc(x.comprador) || 'Sin datos del comprador'}</b>
        <small>${x.doc ? 'Doc. ' + esc(x.doc) + ' · ' : ''}${x.celular ? 'Cel. ' + esc(x.celular) : ''}</small>
        <small>${esc(x.vendedor)}${x.nLista ? ', N° ' + esc(x.nLista) : ''} · ${esc(x.id)}${x.horaIngreso ? ' · ingresó ' + esc(x.horaIngreso) : ''}</small></div>
        <span class="estado e-${esc(x.estado)}">${estadoTexto(x.estado)}</span></div>
      <div class="item-acciones">
        ${x.estado !== 'Anulada' ? `<button onclick="verEntradaEnHoja('${jsArg(x.id)}','${jsArg(x.comprador || 'Entrada')}','${jsArg(x.celular)}','${jsArg(x.comprador)}','${jsArg(x.nLista)}')">Ver entrada</button>` : ''}
        ${admin && x.estado !== 'Anulada' && x.estado !== 'Usada' ? `<button class="peligro" onclick="anular('${jsArg(x.id)}')">Anular</button>` : ''}
      </div>
    </li>`).join('');
}
async function actualizarBusqueda() { await cargarLista(true); buscarEnVivo(); }
const estadoTexto = e => ({ Generada: 'Sin registrar', Entregada: 'Registrada', Usada: 'Ingresó', Anulada: 'Anulada' }[e] || e);
function reenviar(id, nombre, cel) {
  const saludo = nombre && evento.msgComprador ? evento.msgComprador.replace(/\[nombre\]/gi, nombre.split(' ')[0]) : `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}, esta es tu entrada:`;
  const msg = `${saludo}\n${APP_URL}?t=${id}`;
  window.open((cel ? 'https://wa.me/51' + cel : 'https://wa.me/') + '?text=' + encodeURIComponent(msg), '_blank');
}
async function anular(id) {
  const motivo = prompt('¿Por qué se anula la entrada ' + id + '?');
  if (!motivo) return;
  if (!confirm('Se anulará ' + id + ' y ya no podrá ingresar. ¿Continuar?')) return;
  const r = await api('anular', { id, motivo });
  aviso(r.ok ? 'Entrada anulada' : r.error);
  await cargarLista(true);
  buscarEnVivo();
}

// ---------- Entradas por concursante (administración) ----------
function prepararListas() {
  $('lSalida').classList.add('oculto');
  $('lGenerar').classList.toggle('oculto', sesion.rol !== 'Administrador');
  $('lNuevo').classList.toggle('oculto', sesion.rol !== 'Administrador');
  $('nError').textContent = '';
  const items = vendedores.filter(v => v.tipo === 'Concursante').map(v => ({ value: v.codigo, label: v.nombre, sub: v.codigo, v }));
  combo('lConc', items, { placeholder: 'Escribe un nombre', alElegir: it => armarLista(it.v.codigo), alLimpiar: () => $('lSalida').classList.add('oculto') });
}
async function armarLista(cod) {
  const r = await api('listaConcursante', { codigo: cod });
  if (!r.ok) { aviso(r.error); return; }
  listaActual = { codigo: cod, nombre: r.nombre, qrs: r.qrs.sort((a, b) => Number(a.n) - Number(b.n)) };
  $('lAvance').innerHTML = htmlAvance(listaActual.qrs);
  $('lFichas').innerHTML = listaActual.qrs.map(x => {
    const clase = x.estado === 'Usada' ? 'usada' : x.comprador ? 'registrada' : 'libre';
    return `<button type="button" class="ficha ${clase}" onclick="verEntradaEnHoja('${jsArg(x.id)}','Entrada N° ${jsArg(x.n)}','','','${jsArg(x.n)}')" aria-label="Entrada ${esc(x.n)}">${esc(x.n)}<small>${x.id.slice(0, 4)}</small></button>`;
  }).join('');
  const nombreEvento = evento.nombre;
  listaActual.celular = String(r.celular || '').replace(/\D/g, '');
  const plantillaMsg = evento.msgConcursante || 'Hola [nombre], te saluda Meylin de Inka Fashion Perú. Te estamos asignando tus [cantidad] entradas con el nuevo formato y la nueva fecha: [fecha].';
  $('lTexto').value = plantillaMsg.replace(/\[nombre\]/gi, r.nombre.split(' ')[0]).replace(/\[cantidad\]/gi, listaActual.qrs.length).replace(/\[fecha\]/gi, fechaTexto());
  enlacesWhatsApp();
  envio = null;
  $('lCompartir').innerHTML = `<button class="btn btn-oro" onclick="guardarEnCarpeta()">Guardar las ${listaActual.qrs.length} imágenes y abrir el chat</button>`;
  $('lEnvioEstado').textContent = listaActual.celular ? '' : 'Este concursante no tiene celular registrado en la hoja.';
  $('lProgreso').textContent = '';
  $('lAcceso').classList.toggle('oculto', !r.clave);
  if (r.clave) {
    $('lClave').textContent = r.clave;
    const m = `Hola ${r.nombre.split(' ')[0]}, para ver tus entradas de ${nombreEvento} entra a:\n${APP_URL}\nElige ${evento.corto} y escribe tu clave personal: ${r.clave}\nNo la compartas.`;
    $('lWhatsClave').href = 'https://wa.me/?text=' + encodeURIComponent(m);
  }
  $('lSalida').classList.remove('oculto');
}
async function nuevoConcursante() {
  const nombre = $('nNombre').value.trim().replace(/\s+/g, ' ');
  const celular = $('nCel').value.replace(/\D/g, '');
  if (!/^9\d{8}$/.test(celular)) { $('nError').textContent = 'Escribe el celular del concursante: 9 dígitos, empieza con 9'; return; }
  const cupo = Number($('nCupo').value) || 20;
  $('nError').textContent = '';
  if (nombre.length < 3) { $('nError').textContent = 'Escribe el nombre completo'; return; }
  if (celular && !/^9\d{8}$/.test(celular)) { $('nError').textContent = 'El celular debe tener 9 dígitos y empezar con 9'; return; }
  if (cupo < 1 || cupo > 50) { $('nError').textContent = 'Entre 1 y 50 entradas'; return; }
  if (!confirm('¿Crear a ' + nombre + ' con ' + cupo + ' entradas?')) return;
  const btn = $('btnNuevo');
  btn.disabled = true; btn.textContent = 'Creando…';
  const r = await api('nuevoConcursante', { nombre, celular, cupo, opId: opId() });
  btn.disabled = false; btn.textContent = 'Crear y asignar entradas';
  if (!r.ok) { $('nError').textContent = r.error; return; }
  aviso(r.nombre + ' creado como ' + r.codigo + ' con ' + r.cupo + ' entradas');
  $('nNombre').value = ''; $('nCel').value = ''; $('nCupo').value = 20;
  await cargarVendedores(true);
  prepararListas();
  const it = { value: r.codigo, label: r.nombre, sub: r.codigo };
  $('lConc').innerHTML = `<div class="elegido"><div><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></div><button type="button" onclick="prepararListas()">Cambiar</button></div>`;
  await armarLista(r.codigo);
  $('lEnvio').scrollIntoView({ behavior: 'smooth', block: 'start' });
  prepararEnvio();
}
// ---------- Envío por WhatsApp de escritorio ----------
let envio = null;   // imágenes listas para compartir: { codigo, archivos }
function fechaTexto() {
  const f = sesion.config && sesion.config.fechaEvento;
  if (!f) return 'domingo 31 de enero de 2027';
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
}
function enlacesWhatsApp() {
  if (!listaActual) return;
  const t = encodeURIComponent($('lTexto').value), tel = listaActual.celular ? '51' + listaActual.celular : '';
  $('lWhats').href = 'whatsapp://send?' + (tel ? 'phone=' + tel + '&' : '') + 'text=' + t;
  $('lWhatsWeb').href = 'https://web.whatsapp.com/send?' + (tel ? 'phone=' + tel + '&' : '') + 'text=' + t;
}
// Prepara las imágenes de las entradas del concursante (en segundo plano)
async function prepararEnvio() {
  if (!listaActual) return null;
  const datos = listaActual;
  if (envio && envio.codigo === datos.codigo && envio.archivos.length === datos.qrs.length) return envio;
  if (envio && envio.promesa && envio.codigo === datos.codigo) return envio.promesa;
  const estado = $('lEnvioEstado');
  const trabajo = (async () => {
    const qrs = datos.qrs.slice().sort((a, b) => Number(a.n) - Number(b.n)), archivos = [];
    for (let i = 0; i < qrs.length; i++) {
      if (listaActual === datos) estado.textContent = `Preparando imagen ${i + 1} de ${qrs.length}...`;
      const cv = await crearEntrada(qrs[i].id, qrs[i].n);
      const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.9));
      archivos.push(new File([blob], 'Entrada_' + String(qrs[i].n).padStart(2, '0') + '_' + qrs[i].id + '.jpg', { type: 'image/jpeg' }));
    }
    envio = { codigo: datos.codigo, archivos };
    if (listaActual === datos) estado.textContent = `Listas las ${archivos.length} imágenes.`;
    return envio;
  })();
  envio = { codigo: datos.codigo, archivos: [], promesa: trabajo };
  try { return await trabajo; } catch (e) { envio = null; estado.textContent = 'No se pudieron preparar: ' + e.message; return null; }
}
// Carpeta elegida una vez y recordada en este equipo (Chrome o Edge)
let carpetaRaiz = null;
function idb(modo, valor) {
  return new Promise(ok => {
    try {
      const r = indexedDB.open('entradas-inka', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('ajustes');
      r.onerror = () => ok(null);
      r.onsuccess = () => {
        try {
          const tx = r.result.transaction('ajustes', modo === 'leer' ? 'readonly' : 'readwrite'), st = tx.objectStore('ajustes');
          const q = modo === 'leer' ? st.get('carpeta') : st.put(valor, 'carpeta');
          q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null);
        } catch (e) { ok(null); }
      };
    } catch (e) { ok(null); }
  });
}
async function guardarEnCarpeta() {
  if (!listaActual) return;
  const datos = listaActual, estado = $('lEnvioEstado');
  if (!window.showDirectoryPicker) {
    aviso('Abre la app en Chrome o Edge para guardar en carpeta. Ahora se descargan en un ZIP.', 5000);
    lote('zip');
    return;
  }
  try {
    if (!carpetaRaiz) carpetaRaiz = await idb('leer');
    let permiso = carpetaRaiz ? await carpetaRaiz.queryPermission({ mode: 'readwrite' }) : 'no';
    if (carpetaRaiz && permiso !== 'granted') permiso = await carpetaRaiz.requestPermission({ mode: 'readwrite' });
    if (!carpetaRaiz || permiso !== 'granted') {
      carpetaRaiz = await showDirectoryPicker({ id: 'entradas-inka', mode: 'readwrite', startIn: 'documents' });
      idb('guardar', carpetaRaiz);
    }
    const listo = await prepararEnvio();
    if (!listo || listaActual !== datos) return;
    const nombre = (datos.codigo + ' ' + datos.nombre).replace(/[\\/:*?"<>|]/g, '').trim();
    const dir = await carpetaRaiz.getDirectoryHandle(nombre, { create: true });
    for (let i = 0; i < listo.archivos.length; i++) {
      estado.textContent = `Guardando imagen ${i + 1} de ${listo.archivos.length}...`;
      const h = await dir.getFileHandle(listo.archivos[i].name, { create: true });
      const w = await h.createWritable(); await w.write(listo.archivos[i]); await w.close();
    }
    estado.innerHTML = `Listo: ${listo.archivos.length} imágenes en <b>${esc(carpetaRaiz.name)} › ${esc(nombre)}</b>.<br>` +
      `En el chat de ${esc(datos.nombre.split(' ')[0])}: presiona Enviar para el saludo. Luego abre esa carpeta, Ctrl+A y arrastra las imágenes al chat.`;
    try { location.href = $('lWhats').href; } catch (e) { /* queda el botón "Abrir chat" */ }
  } catch (e) {
    if (e.name === 'AbortError') return;
    estado.textContent = 'No se pudieron guardar: ' + e.message + '. Elige otra carpeta (por ejemplo, crea "Entradas Inka" dentro de Documentos).';
    carpetaRaiz = null;
  }
}
async function generar() {
  if (!listaActual) return;
  const cantidad = $('gCant').value;
  if (!confirm('¿Generar ' + cantidad + ' entradas nuevas para ' + listaActual.nombre + '?')) return;
  const r = await api('generar', { codigo: listaActual.codigo, cantidad });
  aviso(r.ok ? 'Se generaron ' + r.generados + ' entradas' : r.error);
  if (r.ok) armarLista(listaActual.codigo);
}
function htmlAvance(qrs) {
  const total = qrs.filter(x => x.estado !== 'Anulada').length;
  const reg = qrs.filter(x => x.comprador && x.estado !== 'Anulada').length;
  const ing = qrs.filter(x => x.estado === 'Usada').length;
  const circ = 2 * Math.PI * 46, pct = total ? reg / total : 0;
  return `<div class="avance">
    <div class="anillo"><svg viewBox="0 0 104 104"><circle class="fondo-anillo" cx="52" cy="52" r="46" fill="none" stroke-width="10"/>
      <circle class="valor" cx="52" cy="52" r="46" fill="none" stroke-width="10" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/></svg>
      <div><span><b>${reg}</b><small>de ${total}</small></span></div></div>
    <ul><li><span>Registradas</span><b>${reg}</b></li><li><span>Sin registrar</span><b>${total - reg}</b></li><li><span>Ya ingresaron</span><b>${ing}</b></li></ul>
  </div>`;
}

// ---------- Mis entradas (concursante o caja) ----------
async function cargarMis() {
  $('misLista').innerHTML = '<li class="nota">Cargando...</li>';
  const r = await api('misEntradas');
  if (!r.ok) { $('misAvance').innerHTML = `<p class="error">${esc(r.error)}</p>`; $('misLista').innerHTML = ''; return; }
  misDatos = r;
  const esCaja = r.codigo === 'CAJA';
  $('misTitulo').textContent = esCaja ? 'Ventas en puerta' : 'Mis entradas';
  $('misAvance').innerHTML = esCaja
    ? `<div class="cifras" style="margin:0"><div class="cifra"><b>${r.qrs.length}</b><span>Ventas</span></div><div class="cifra"><b>${r.qrs.filter(x => x.estado === 'Usada').length}</b><span>Ingresaron</span></div><div class="cifra"><b>${r.qrs.reduce((s, x) => s + (Number(String(x.monto).replace(',', '.')) || 0), 0)}</b><span>Soles</span></div></div>`
    : htmlAvance(r.qrs);
  $('misLote').classList.toggle('oculto', esCaja);
  pintarMis();
}
function filtrarMis(b) {
  document.querySelectorAll('#misFiltro button').forEach(x => x.classList.toggle('sel', x === b));
  misFiltro = b.dataset.f;
  pintarMis();
}
function pintarMis() {
  if (!misDatos) return;
  const f = { todas: x => true, libres: x => !x.comprador && x.estado !== 'Anulada', registradas: x => !!x.comprador, ingresaron: x => x.estado === 'Usada' }[misFiltro];
  const lista = misDatos.qrs.filter(f).sort((a, b) => (Number(a.n) || 0) - (Number(b.n) || 0));
  $('misLista').innerHTML = lista.length ? lista.map(x => `
    <li><div class="item-cab"><div><b>${x.n ? 'Entrada N° ' + esc(x.n) : esc(x.comprador)}</b>
      <small>${x.comprador ? esc(x.comprador) + (x.doc ? ' · Doc. ' + esc(x.doc) : '') : 'Aún sin comprador registrado'}</small>
      <small>${esc(x.id)}${x.metodo ? ' · ' + esc(x.metodo) : ''}${x.horaIngreso ? ' · ingresó ' + esc(x.horaIngreso) : ''}</small></div>
      <span class="estado e-${esc(x.estado)}">${estadoTexto(x.estado)}</span></div>
      ${x.estado !== 'Anulada' ? `<div class="item-acciones"><button onclick="verEntradaEnHoja('${jsArg(x.id)}','${x.n ? 'Entrada N° ' + jsArg(x.n) : 'Entrada'}','','','${jsArg(x.n)}')">Ver entrada</button></div>` : ''}
    </li>`).join('') : '<li class="nota">No hay entradas en este grupo.</li>';
}

// ---------- Resumen ----------
async function verResumen() {
  const r = await api('resumen');
  const c = $('resDatos');
  if (!r.ok) { c.innerHTML = '<p class="error">' + esc(r.error) + '</p>'; return; }
  const s = r.resumen;
  const fila = (a, b) => `<div class="dato"><span>${a}</span><b>${b}</b></div>`;
  c.innerHTML = `<div class="cifras">${[[s.total - s.anulada, 'Entradas'], [s.entregada + s.usada, 'Con comprador'], [s.usada, 'Ingresaron']].map(x => `<div class="cifra vidrio"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>
    <div class="vidrio panel"><h3>Estado de las entradas</h3><div class="datos">${fila('Sin datos del comprador', s.generada) + fila('Registradas, aún no ingresan', s.entregada) + fila('Ya ingresaron', s.usada) + fila('Anuladas', s.anulada) + fila('Escaneos rechazados', s.rechazos)}</div></div>
    <div class="vidrio panel"><h3>Caja en puerta</h3><div class="datos">${(Object.keys(s.caja).map(m => fila(m, s.caja[m])).join('') || fila('Ventas', 0)) + fila('Total cobrado', 'S/ ' + s.montoCaja)}</div></div>
    <div class="vidrio panel"><h3>Dinero por método de pago</h3><div class="datos">${(Object.keys(s.metodos || {}).map(m => fila(esc(m), 'S/ ' + s.metodos[m])).join('') || fila('Ventas', 0)) + fila('Total', 'S/ ' + (s.montoTotal || 0)) + fila('Códigos de reserva libres', s.reserva == null ? '-' : s.reserva)}</div>
    <p class="nota">Solo ${esc(evento.corto)}. El detalle completo está en la hoja de Google.</p></div>`;
}

// ---------- Sorteo (solo Administración, en el evento elegido) ----------
function prepararSorteo() {
  $('sEvento').textContent = evento.corto;
  $('sResultado').innerHTML = '';
}
async function sortear() {
  if (!confirm('¿Sortear ahora entre las entradas de ' + evento.corto + ' que ya ingresaron?')) return;
  const btn = $('btnSortear'); btn.disabled = true;
  const r = await api('sorteo');
  btn.disabled = false;
  const c = $('sResultado');
  if (!r.ok) { c.innerHTML = `<div class="vidrio panel"><p class="error" style="margin:0">${esc(r.error)}</p></div>`; return; }
  c.innerHTML = `<div class="vidrio panel ganador">
    <span class="etiqueta" style="margin-top:0">Sorteo N.º ${esc(r.sorteoN)}, entre ${esc(r.participantes)} participantes</span>
    <div class="ganador-num">N.º ${esc(r.n || '-')}</div>
    <div class="codigo">${esc(r.id)}</div>
    <div class="datos"><div class="dato"><span>Ganador</span><b>${esc(r.comprador)}</b></div><div class="dato"><span>Documento</span><b>${esc(r.doc || '-')}</b></div><div class="dato"><span>Vendió</span><b>${esc(r.vendedor)}</b></div></div>
    <p class="nota">Quedó anotado en el Historial. Este ganador no vuelve a salir en los siguientes sorteos.</p></div>`;
  sonido(true);
}

// ---------- Diseño de la entrada ----------
// Diseño de la entrada: cada evento trae su plantilla y sus casillas desde la pestaña Eventos.
// Medidas en píxeles de la imagen base (ancho x alto de la pestaña): se escalan solas.
// Este es el diseño de Inka Fashion, por si el servidor no envía otro.
const DISENO_INKA = {
  plantilla: 'entrada.webp?v=6', ancho: 2160, alto: 2700,
  cajaQR: { x: 220, y: 1836, w: 600, h: 600 },   // recuadro blanco del talón
  cajaNum: { x: 280, y: 2498, w: 104, h: 68 },   // casilla "N.º"
  cajaCod: { x: 444, y: 2498, w: 396, h: 68 },   // casilla del código de 10 caracteres
  tinta: '#3B2212'
};
const FUENTE = 'Montserrat, "Segoe UI", Arial, sans-serif';
let plantillas = {};   // imágenes ya cargadas, por archivo
const disenoActual = () => (evento && evento.plantilla && evento.ancho) ? evento : DISENO_INKA;

function cargarPlantilla(d) {
  const src = (d || disenoActual()).plantilla;
  if (!plantillas[src]) {
    plantillas[src] = new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => { delete plantillas[src]; mal(new Error('No se encontró el diseño de la entrada')); };
      i.src = src;
    });
  }
  return plantillas[src];
}
function matrizQR(texto) {
  const q = new QRCode(document.createElement('div'), { text: texto, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M });
  const m = q._oQRCode, n = m.getModuleCount(), out = [];
  for (let r = 0; r < n; r++) { const fila = []; for (let c = 0; c < n; c++) fila.push(m.isDark(r, c)); out.push(fila); }
  return out;
}
async function crearEntrada(id, n, diseno) {
  const D = diseno || disenoActual();
  const img = await cargarPlantilla(D);
  try { await document.fonts.load('700 40px Montserrat'); } catch (e) { /* usa la fuente de respaldo */ }
  // La imagen puede venir en cualquier tamaño: se trabaja a 2000 px como máximo (liviana para WhatsApp)
  const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const sx = cv.width / D.ancho, sy = cv.height / D.alto;
  const caja = k => ({ x: k.x * sx, y: k.y * sy, w: k.w * sx, h: k.h * sy });

  // QR negro sobre blanco, centrado y con margen para que el lector lo capte fácil
  const B = caja(D.cajaQR);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(B.x, B.y, B.w, B.h);
  if (!id) throw new Error('Esta entrada no tiene código. Vuelve a abrirla desde Buscar.');
  const m = matrizQR(id), nm = m.length;
  const cel = Math.max(1, Math.floor(Math.min(B.w, B.h) * 0.86 / nm)), lado = cel * nm;
  const x0 = Math.round(B.x + (B.w - lado) / 2), y0 = Math.round(B.y + (B.h - lado) / 2);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < nm; r++) for (let c = 0; c < nm; c++) if (m[r][c]) ctx.fillRect(x0 + c * cel, y0 + r * cel, cel, cel);

  ctx.fillStyle = D.tinta || '#1A1A1A';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // Escribe el texto centrado en la casilla, achicándolo si no entra
  const centrar = (k, texto, ancho) => {
    const b = caja(k);
    let t = Math.round(b.h * 0.6);
    ctx.font = `700 ${t}px ${FUENTE}`;
    const w = ancho(texto);
    if (w > b.w * 0.86) { t = Math.floor(t * b.w * 0.86 / w); ctx.font = `700 ${t}px ${FUENTE}`; }
    const alto = ctx.measureText('H').actualBoundingBoxAscent || t * 0.72;
    return { b, base: b.y + (b.h + alto) / 2 };
  };

  // Número de la entrada
  const num = /^\d+$/.test(String(n || '').trim()) ? String(Number(n)).padStart(2, '0') : '';
  if (num) {
    const { b, base } = centrar(D.cajaNum, num, t => ctx.measureText(t).width);
    ctx.fillText(num, b.x + b.w / 2, base);
  }

  // Código de 10 caracteres, letra por letra con el mismo espacio (fácil de leer y dictar)
  const letras = String(id).split('');
  const paso = () => ctx.measureText('W').width * 1.1 * letras.length; // mismo tamaño en todas las entradas
  const { b, base } = centrar(D.cajaCod, id, paso);
  const avance = paso() / letras.length;
  const xi = b.x + b.w / 2 - avance * (letras.length - 1) / 2;
  letras.forEach((l, i) => ctx.fillText(l, xi + i * avance, base));
  return cv;
}
async function mostrarDiseno(idCont, id, n, diseno) {
  const cont = $(idCont);
  try {
    const cv = await crearEntrada(id, n, diseno);
    entradaActual = { id, cv };
    const im = document.createElement('img');
    im.alt = 'Entrada ' + id; im.src = cv.toDataURL('image/jpeg', 0.9);
    cont.innerHTML = ''; cont.appendChild(im);
    return true;
  } catch (e) {
    cont.innerHTML = '<p class="error">' + esc(e.message) + '</p>';
    return false;
  }
}
const pngActual = () => new Promise(ok => entradaActual.cv.toBlob(ok, 'image/png'));
async function descargarPNG() { if (entradaActual) bajar(await pngActual(), 'Entrada_' + entradaActual.id + '.png'); }
function descargarPDF() {
  if (!entradaActual) return;
  const cv = entradaActual.cv;
  const pdf = new jspdf.jsPDF({ unit: 'px', format: [cv.width, cv.height], hotfixes: ['px_scaling'] });
  pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, cv.width, cv.height);
  pdf.save('Entrada_' + entradaActual.id + '.pdf');
}
async function compartirEntrada() {
  if (!entradaActual) return;
  const blob = await pngActual();
  const archivo = new File([blob], 'Entrada_' + entradaActual.id + '.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: 'Entrada' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  bajar(blob, archivo.name);
}
async function lote(tipo, propias) {
  const datos = propias ? misDatos : listaActual;
  const prog = $(propias ? 'misProgreso' : 'lProgreso');
  if (!datos) return;
  const qrs = datos.qrs.filter(x => x.estado !== 'Anulada').sort((a, b) => Number(a.n) - Number(b.n));
  if (!qrs.length) { prog.textContent = 'No hay entradas para descargar.'; return; }
  const base = 'Entradas_' + (datos.codigo || '') + '_' + datos.nombre.replace(/\s+/g, '_');
  try {
    let zip = tipo === 'zip' ? new JSZip() : null, pdf = null;
    for (let i = 0; i < qrs.length; i++) {
      const q = qrs[i];
      prog.textContent = `Preparando entrada ${i + 1} de ${qrs.length}...`;
      const cv = await crearEntrada(q.id, q.n);
      const nombre = 'Entrada_' + String(q.n).padStart(2, '0') + '_' + q.id;
      if (zip) zip.file(nombre + '.jpg', await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.9)));
      else {
        if (!pdf) pdf = new jspdf.jsPDF({ unit: 'px', format: [cv.width, cv.height], hotfixes: ['px_scaling'] });
        else pdf.addPage([cv.width, cv.height]);
        pdf.addImage(cv.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, cv.width, cv.height);
      }
    }
    prog.textContent = 'Guardando archivo...';
    if (zip) bajar(await zip.generateAsync({ type: 'blob' }), base + '.zip');
    else pdf.save(base + '.pdf');
    prog.textContent = 'Listo. Revisa tus descargas.';
  } catch (e) {
    prog.textContent = 'No se pudo generar: ' + e.message;
  }
}

// ---------- Lista de respaldo (por si cae el internet en la puerta) ----------
// Se puede bajar la lista de cualquier evento (la puerta del sábado necesita la de Kids y la de India)
let rpEvento = '', rpDatos = null;
const eventosConocidos = () => eventosLista.length ? eventosLista : EVENTOS_RESPALDO;
const eventoRespaldo = () => eventosConocidos().find(e => e.clave === rpEvento) || evento;
async function prepararRespaldo() {
  $('rpVolver').classList.toggle('oculto', sesion.rol !== 'Puerta');
  if (!rpEvento) rpEvento = evento.clave;
  pintarRpEventos();
  await cargarRespaldo();
}
function pintarRpEventos() {
  $('rpEventos').innerHTML = eventosConocidos().map(e => `<button type="button" class="${e.clave === rpEvento ? 'sel' : ''}" aria-pressed="${e.clave === rpEvento}" onclick="elegirRpEvento('${jsArg(e.clave)}')">${esc(e.corto)}</button>`).join('');
}
async function elegirRpEvento(clave) { rpEvento = clave; pintarRpEventos(); await cargarRespaldo(); }
async function cargarRespaldo() {
  const pedido = rpEvento;
  rpDatos = null;
  $('rpEstado').textContent = 'Cargando entradas...';
  $('rpCuerpo').innerHTML = '';
  let datos = null;
  if (pedido === evento.clave) datos = await cargarLista(true);
  else {
    const r = await api('lista', { evento: pedido }, true);
    if (r.ok) datos = { filas: r.filas, hora: r.hora }; else aviso(r.error);
  }
  if (pedido !== rpEvento) return;   // se tocó otro evento mientras cargaba
  rpDatos = datos;
  pintarRespaldo();
}
function filasRespaldo() {
  const q = $('rpQ').value.trim();
  const filas = q.length >= 2 ? filtrarLista(q, rpDatos) : (rpDatos ? rpDatos.filas.slice() : []);
  return filas.sort((a, b) => a[0].localeCompare(b[0]));
}
function pintarRespaldo() {
  if (!rpDatos) { $('rpEstado').textContent = 'No se pudo cargar la lista. Revisa tu conexión.'; return; }
  const filas = filasRespaldo(), max = 300;
  const total = rpDatos.filas.length, ing = rpDatos.filas.filter(f => f[6] === 'Usada').length;
  $('rpEstado').textContent = `${eventoRespaldo().corto}: ${total} ${total === 1 ? 'entrada vendida o asignada' : 'entradas vendidas o asignadas'} · ${ing} ya ingresaron · datos de las ${rpDatos.hora.slice(-5)}` +
    (filas.length > max ? ` · se muestran ${max} de ${filas.length}, el PDF trae todas` : '');
  $('rpCuerpo').innerHTML = filas.slice(0, max).map(f => `<tr class="${f[6] === 'Anulada' ? 'anulada' : ''}">
    <td class="mono">${esc(f[0])}</td><td>${esc(f[1])}</td><td>${esc(f[2]) || '—'}</td><td>${esc(f[3]) || '—'}</td><td>${esc(f[5])}</td><td>${estadoTexto(f[6])}</td></tr>`).join('') ||
    '<tr><td colspan="6">Sin entradas para mostrar.</td></tr>';
}
function descargarRespaldo() {
  if (!rpDatos) return;
  const filas = filasRespaldo(), datos = rpDatos, evRp = eventoRespaldo();
  const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cols = [['Código', 32], ['N.º', 12], ['Comprador', 78], ['Documento', 28], ['Vendedor', 62], ['Estado', 30], ['Visto', 15]];
  const x0 = 12, alto = 6.4, porPag = 27, paginas = Math.max(1, Math.ceil(filas.length / porPag));
  const nombreEv = evRp.nombre || evRp.corto;
  const corta =(t, w) => { t = String(t || ''); while (t && pdf.getTextWidth(t) > w - 3) t = t.slice(0, -1); return t; };
  for (let p = 0; p < paginas; p++) {
    if (p) pdf.addPage();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
    pdf.text('Lista de respaldo · ' + nombreEv, x0, 13);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    pdf.text(`${evRp.fechaTexto ? evRp.fechaTexto + ', ' + evRp.horario + ' · ' : ''}Generada ${datos.hora} · ${filas.length} entradas · ordenadas por código · página ${p + 1} de ${paginas}`, x0, 18.5);
    let y = 25, x = x0;
    pdf.setFillColor(36, 24, 46); pdf.rect(x0, y - 4.6, 257, alto, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
    cols.forEach(c => { pdf.text(c[0], x + 1.5, y); x += c[1]; });
    pdf.setTextColor(30, 20, 15); pdf.setFont('helvetica', 'normal');
    filas.slice(p * porPag, (p + 1) * porPag).forEach((f, i) => {
      y += alto; x = x0;
      if (i % 2) { pdf.setFillColor(244, 238, 228); pdf.rect(x0, y - 4.6, 257, alto, 'F'); }
      const v = [f[0], f[1], f[2] || '—', f[3] || '—', f[5], estadoTexto(f[6]), ''];
      pdf.setFont(f[6] === 'Anulada' ? 'helvetica' : 'helvetica', f[6] === 'Anulada' ? 'bold' : 'normal');
      cols.forEach((c, k) => { if (k === 6) pdf.rect(x + 5, y - 3.4, 4, 4); else pdf.text(corta(v[k], c[1]), x + 1.5, y); x += c[1]; });
    });
  }
  pdf.save('Lista_respaldo_' + evRp.clave + '_' + datos.hora.replace(/[\/: ]/g, '-') + '.pdf');
}

// ---------- Entrada pública ----------
async function verTicket(id) {
  $('subtituloMarca').textContent = 'Tu entrada';
  mostrar('ticket');
  const r = await api('ticket', { id });
  // Cada entrada muestra el diseño y el nombre de su propio evento
  if (r.ok && r.ev) {
    $('subtituloMarca').textContent = r.ev.corto;
    document.documentElement.style.setProperty('--ev', r.ev.color);
    document.title = r.ev.corto + ' · Tu entrada';
    $('tEvento').innerHTML = `<b>${esc(r.ev.nombre)}</b><span>${esc(r.ev.fechaTexto)}, de ${esc(r.ev.horario)}</span><span>${esc(r.ev.lugar)}</span>`;
    $('tEvento').classList.remove('oculto');
  }
  const diseno = r.ok && r.diseno && r.diseno.plantilla && r.diseno.ancho ? r.diseno : DISENO_INKA;
  if (!r.ok || r.estado === 'Anulada') {
    $('tError').textContent = r.ok ? 'Esta entrada fue anulada. Comunícate con la organización.' : r.error;
    $('tDiseno').innerHTML = '';
  } else if (await mostrarDiseno('tDiseno', id, r.n, diseno)) {
    $('tBotones').classList.remove('oculto');
  }
  if (!r.ok) { ['tNombre', 'tDoc', 'tVend', 'tEstado'].forEach(k => $(k).textContent = '-'); return; }
  $('tNombre').textContent = r.comprador || 'Pendiente de registro';
  $('tDoc').textContent = r.doc || '-';
  $('tVend').textContent = r.vendedor;
  $('tEstado').textContent = r.estado === 'Usada' ? 'Ya ingresó' : r.estado === 'Anulada' ? 'Anulada' : 'Válida';
}

// ---------- Inicio ----------
(async function inicio() {
  $('clave').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  $('codigoManual').addEventListener('keydown', e => { if (e.key === 'Enter') validarManual(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarHoja(); });
  const t = new URLSearchParams(location.search).get('t');
  if (t) { verTicket(t.toUpperCase()); return; }
  // Nunca entra solo: aunque la clave esté guardada, siempre hay que elegir el evento y tocar "Entrar"
  pantallaIngreso();
})();
