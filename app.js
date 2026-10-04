/* Inka Fashion Perú · Control de entradas */
'use strict';

const API = 'https://script.google.com/macros/s/AKfycbzNQTpl4UMnX8DPNTzuEgMbdmjvNK06GRHC7STFHKR8fTZYtsqFBvA6y4d3yazzVVWc4w/exec';
const APP_URL = location.origin + location.pathname;

let sesion = null;          // { clave, nombre, rol, codigo, config, precio }
let vendedores = [];
let lector = null, escaneando = false, ultimoCodigo = '', ultimoTiempo = 0, temporizador = null;
let registro = { vendedor: null, qrs: [], id: '' };
let listaActual = null, misDatos = null, misFiltro = 'todas';
let entradaActual = null, plantillaPromesa = null, busquedaTimer = null;

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
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  no: '<path d="M7 7l10 10M17 7L7 17"/>',
  alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.5"/>'
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
  resumen: ['Resumen', 'Totales y caja']
};
const ROLES = {
  Administrador: { pestanas: ['inicio', 'escanear', 'registrar', 'buscar'], mosaico: ['escanear', 'registrar', 'caja', 'buscar', 'listas', 'resumen'], inicio: 'inicio' },
  Registro: { pestanas: ['inicio', 'registrar', 'buscar', 'listas'], mosaico: ['registrar', 'buscar', 'listas'], inicio: 'inicio' },
  Caja: { pestanas: ['inicio', 'caja', 'mis', 'buscar'], mosaico: ['caja', 'mis', 'buscar'], inicio: 'inicio' },
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
  try {
    const cuerpo = Object.assign({ accion, clave: sesion ? sesion.clave : '' }, datos);
    const r = await fetch(API, { method: 'POST', body: JSON.stringify(cuerpo) });
    const j = await r.json();
    if (j.sesion === false && sesion && sesion.nombre) { salir(); aviso('Tu clave ya no es válida. Ingresa de nuevo.'); }
    return j;
  } catch (e) {
    return { ok: false, error: 'Sin conexión. Revisa tu internet e inténtalo otra vez.' };
  } finally {
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
  if (v === 'escanear') { mostrar('escanear'); iniciarLector(); }
  if (v === 'registrar') { await cargarVendedores(); prepararRegistro(); mostrar('registrar'); }
  if (v === 'caja') { prepararCaja(); mostrar('caja'); }
  if (v === 'buscar') { mostrar('buscar'); setTimeout(() => $('bQ').focus(), 50); }
  if (v === 'listas') { await cargarVendedores(); prepararListas(); mostrar('listas'); }
  if (v === 'mis') { mostrar('mis'); cargarMis(); }
  if (v === 'resumen') { mostrar('resumen'); verResumen(); }
}
function pintarPestanas() {
  const p = ROLES[sesion.rol].pestanas, nav = $('pestanas');
  nav.classList.toggle('oculto', !p.length);
  nav.innerHTML = p.map(v => `<button data-v="${v}" onclick="abrir('${v}')">${icono(v)}<span>${SECCIONES[v][0]}</span></button>`).join('');
}
function pintarInicio() {
  const r = ROLES[sesion.rol];
  const hora = new Date().getHours();
  $('saludo').textContent = (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + sesion.nombre.split(' ')[0];
  $('saludoRol').textContent = NOMBRE_ROL[sesion.rol];
  const m = r.mosaico;
  $('mosaico').innerHTML = m.map((v, i) => `<button class="vidrio${i === 0 && m.length % 2 ? ' ancho' : ''}" onclick="abrir('${v}')">${icono(v)}<div><b>${SECCIONES[v][0]}</b><span>${SECCIONES[v][1]}</span></div></button>`).join('');
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
async function entrar() {
  const clave = $('clave').value.trim(), err = $('loginError');
  err.textContent = '';
  if (!clave) { err.textContent = 'Escribe tu clave'; return; }
  sesion = { clave };
  const r = await api('login');
  if (!r.ok) { sesion = null; err.textContent = r.error; return; }
  iniciarSesion(clave, r);
}
function iniciarSesion(clave, r) {
  sesion = { clave, nombre: r.nombre, rol: r.rol, codigo: r.codigo || '', config: r.config };
  try { localStorage.setItem('clave', clave); } catch (e) {}
  $('clave').value = '';
  $('avatar').textContent = sesion.nombre.trim().charAt(0).toUpperCase();
  $('avatar').classList.remove('oculto');
  $('menuNombre').textContent = sesion.nombre;
  $('menuRol').textContent = NOMBRE_ROL[sesion.rol] || sesion.rol;
  $('subtituloMarca').textContent = NOMBRE_ROL[sesion.rol] || 'Control de entradas';
  pintarPestanas();
  abrir(ROLES[sesion.rol].inicio);
}
function salir() {
  detenerLector();
  sesion = null;
  try { localStorage.removeItem('clave'); } catch (e) {}
  $('avatar').classList.add('oculto');
  $('menuUsuario').classList.add('oculto');
  $('pestanas').classList.add('oculto');
  $('subtituloMarca').textContent = 'Control de entradas';
  mostrar('login');
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
function htmlComprador(p) {
  return `
    <label for="${p}Nombre">Nombre completo</label>
    <input type="text" id="${p}Nombre" autocomplete="off" autocapitalize="words" placeholder="Como figura en su documento">
    <div class="dos">
      <div><label for="${p}TipoDoc">Documento</label>
        <select id="${p}TipoDoc"><option>DNI</option><option>Carnet de extranjería</option><option>Pasaporte</option></select></div>
      <div><label for="${p}Doc">Número</label><input type="text" id="${p}Doc" inputmode="numeric" autocomplete="off"></div>
    </div>
    <label for="${p}Cel">Celular con WhatsApp</label>
    <input type="tel" id="${p}Cel" inputmode="numeric" maxlength="9" placeholder="9XX XXX XXX">
    <p class="nota">Para menores de edad, usa el DNI del adulto que lo acompaña.</p>`;
}
function htmlPago(p, monto, editable, conRegalo) {
  const metodos = ['Efectivo', 'Yape', 'Plin', 'Transferencia'].concat(conRegalo ? ['Regalo'] : []);
  return `
    <div class="dos">
      <div><label for="${p}Monto">Monto (S/)</label>
        <input type="number" id="${p}Monto" inputmode="decimal" min="0" step="0.5" value="${monto}" ${editable ? '' : 'readonly'}></div>
      <div id="${p}OperBloque" class="oculto"><label for="${p}Oper">Código de operación</label>
        <input type="text" id="${p}Oper" inputmode="numeric" autocomplete="off" placeholder="Del comprobante"></div>
    </div>
    <span class="etiqueta">Método de pago</span>
    <div class="segmentos" id="${p}Metodos">${metodos.map(m => `<button type="button" data-m="${m}" onclick="elegirMetodo('${p}', this)">${m}</button>`).join('')}</div>`;
}
function elegirMetodo(p, b) {
  document.querySelectorAll('#' + p + 'Metodos button').forEach(x => x.classList.remove('sel'));
  b.classList.add('sel');
  const m = b.dataset.m === 'Regalo' ? 'Regalo (sin pago)' : b.dataset.m;
  $(p + 'Metodos').dataset.valor = m;
  $(p + 'OperBloque').classList.toggle('oculto', !['Yape', 'Plin', 'Transferencia'].includes(m));
  const monto = $(p + 'Monto');
  if (m === 'Regalo (sin pago)' && !monto.readOnly) monto.value = 0;
  else if (!monto.readOnly && Number(monto.value) === 0) monto.value = sesion.precio || '';
}
function leerComprador(p) {
  return { nombre: $(p + 'Nombre').value, tipoDoc: $(p + 'TipoDoc').value, doc: $(p + 'Doc').value, celular: $(p + 'Cel').value };
}
function leerPago(p) {
  return { metodo: $(p + 'Metodos').dataset.valor || '', operacion: $(p + 'Oper').value, monto: $(p + 'Monto').value };
}
function validarLocal(d) {
  if ((d.nombre || '').trim().length < 3) return 'Escribe el nombre completo';
  if (!d.doc.trim()) return 'Escribe el número de documento';
  if (d.tipoDoc === 'DNI' && !/^\d{8}$/.test(d.doc.trim())) return 'El DNI debe tener 8 números';
  if (!/^9\d{8}$/.test(d.celular.replace(/\D/g, ''))) return 'El celular debe tener 9 números y empezar con 9';
  if (!d.metodo) return 'Elige el método de pago';
  if (d.monto === '' || isNaN(Number(d.monto)) || Number(d.monto) < 0) return 'Escribe el monto';
  if (['Yape', 'Plin', 'Transferencia'].includes(d.metodo) && !d.operacion.trim()) return 'Escribe el código de operación';
  return '';
}

// ---------- Registrar ----------
async function cargarVendedores() {
  const r = await api('vendedores');
  if (r.ok) { vendedores = r.vendedores; sesion.precio = r.precio; }
}
function prepararRegistro() {
  registro = { vendedor: null, qrs: [], id: '' };
  $('bloqueQR').classList.add('oculto');
  $('rDatos').classList.add('oculto');
  $('rError').textContent = '';
  $('btnRegistrar').dataset.op = opId();
  const items = vendedores.filter(v => v.codigo !== 'CAJA').map(v => ({ value: v.codigo, label: v.nombre, sub: v.tipo + ' · ' + v.codigo, v }));
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
    ? '<p class="nota" style="margin-top:-4px">Lo que pagó el comprador al concursante. Si fue un regalo, elige Regalo.</p>' + htmlPago('r', sesion.precio, true, true)
    : htmlPago('r', sesion.precio, false, false);
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
  if (e) { err.textContent = e; return; }
  const btn = $('btnRegistrar'); d.opId = btn.dataset.op; btn.disabled = true;
  const r = await api('registrar', d);
  btn.disabled = false;
  if (!r.ok) { err.textContent = r.error; return; }
  hecho(r.id, d.nombre, d.celular, esConc ? `Entrada N° ${r.numero} de ${v.nombre}` : `Venta de ${v.nombre} · S/ ${d.monto}`, () => abrir('registrar'));
}

// ---------- Caja ----------
function prepararCaja() {
  const precio = sesion.config ? sesion.config.precioDia : 30;
  $('bloqueCompradorCaja').innerHTML = htmlComprador('c');
  $('bloquePagoCaja').innerHTML = htmlPago('c', precio, false, false);
  $('btnCaja').textContent = 'Cobrar S/ ' + precio + ' y registrar';
  $('cError').textContent = '';
  $('cIngresa').checked = true;
  $('btnCaja').dataset.op = opId();
}
async function venderCaja() {
  const err = $('cError'); err.textContent = '';
  const d = Object.assign({}, leerComprador('c'), leerPago('c'));
  const e = validarLocal(d);
  if (e) { err.textContent = e; return; }
  d.ingresaAhora = $('cIngresa').checked;
  const btn = $('btnCaja'); d.opId = btn.dataset.op; btn.disabled = true;
  const r = await api('venderPuerta', d);
  btn.disabled = false;
  if (!r.ok) { err.textContent = r.error; return; }
  hecho(r.id, d.nombre, d.celular, `Cobrado S/ ${r.monto} con ${d.metodo}. ` + (r.ingreso ? 'Ya puede pasar: ponle el sello.' : 'Debe pasar por el escáner.'), () => abrir('caja'));
}

// ---------- Venta completada ----------
function hecho(id, nombre, cel, texto, otra) {
  $('hTexto').textContent = texto;
  $('hCodigo').textContent = id;
  $('hDiseno').innerHTML = '<div class="esperando">Preparando la entrada...</div>';
  const link = APP_URL + '?t=' + id;
  const msg = `Hola ${nombre.split(' ')[0]}, esta es tu entrada para ${sesion.config ? sesion.config.evento : 'el evento'}:\n${link}\nMuéstrala en la puerta. Cada QR sirve para un solo ingreso.`;
  $('hWhats').href = 'https://wa.me/51' + cel.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
  $('hOtra').onclick = otra;
  mostrar('hecho');
  mostrarDiseno('hDiseno', id);
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
  const c = $('codigoManual').value.trim().toUpperCase();
  if (c.length !== 10) { aviso('El código tiene 10 caracteres'); return; }
  escaneando = false;
  try { lector && lector.pause(true); } catch (e) {}
  $('codigoManual').value = '';
  validar(c);
}
async function validar(codigo) {
  abrirHoja('aviso', `<div class="veredicto"><div class="sello">${icono('escanear')}</div><div><h2>Validando</h2><p>${esc(codigo)}</p></div></div>`);
  const r = await api('escanear', { id: codigo }, true);
  const filas = pares => '<div class="datos">' + pares.filter(p => p[1]).map(p => `<div class="dato"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('') + '</div>';
  const siguiente = '<button class="btn btn-vidrio" onclick="siguienteEscaneo()">Escanear siguiente</button>';
  if (!r.ok) {
    abrirHoja('aviso', `<div class="veredicto"><div class="sello">${icono('alerta')}</div><div><h2>Sin respuesta</h2><p>${esc(r.error)}</p></div></div>${siguiente}`);
    sonido(false); return;
  }
  const vend = r.vendedor ? r.vendedor + (r.tipoVendedor === 'Concursante' ? ' · concursante' + (r.nLista ? ', N° ' + r.nLista : '') : ' · organización') : '';
  const comunes = [['Comprador', r.comprador], [r.tipoDoc || 'Documento', r.doc], ['Vendió', vend], ['Registrada', r.fechaRegistro], ['Escaneada', r.horaEscaneo], ['Código', r.id]];
  if (r.resultado === 'Válido') {
    abrirHoja('ok', `<div class="veredicto"><div class="sello">${icono('ok', 'stroke-width="2.6"')}</div><div><h2>Puede pasar</h2><p>${r.sinDatos ? 'Concursante sin datos del comprador: pide su DNI si puedes.' : 'Ponle el sello en el brazo.'}</p></div></div>${filas(comunes)}${siguiente}`);
    sonido(true);
    temporizador = setTimeout(siguienteEscaneo, 3500);
  } else if (r.resultado === 'Ya usado') {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('no', 'stroke-width="2.6"')}</div><div><h2>Ya fue usada</h2><p>Ingresó ${esc(r.horaIngreso)} · escaneó ${esc(r.escaneadoPor)}</p></div></div>${filas(comunes)}<p class="nota" style="color:rgba(255,255,255,.8)">Si tiene sello, es un reingreso. Si no, llama al supervisor.</p>${siguiente}`);
    sonido(false);
  } else if (r.resultado === 'Anulado') {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('no', 'stroke-width="2.6"')}</div><div><h2>Entrada anulada</h2><p>Deriva al supervisor.</p></div></div>${filas(comunes.concat([['Motivo', r.obs]]))}${siguiente}`);
    sonido(false);
  } else {
    abrirHoja('mal', `<div class="veredicto"><div class="sello">${icono('alerta')}</div><div><h2>No existe</h2><p>Este código no es del evento. Deriva a caja o al supervisor.</p></div></div>${filas([['Leído', r.id], ['Escaneada', r.horaEscaneo]])}${siguiente}`);
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
async function verEntradaEnHoja(id, titulo, cel, nombre) {
  abrirHoja('', `<h2 style="margin-top:0">${esc(titulo)}</h2><div id="hojaDiseno" class="disenio"><div class="esperando">Preparando la entrada...</div></div><div class="codigo">${esc(id)}</div>
    <button class="btn btn-oro" onclick="compartirEntrada()">Guardar o compartir</button>
    <div class="fila-btn"><button class="btn btn-vidrio" onclick="descargarPNG()">Imagen PNG</button><button class="btn btn-vidrio" onclick="descargarPDF()">Archivo PDF</button></div>
    ${cel ? `<button class="btn btn-vidrio" onclick="reenviar('${jsArg(id)}','${jsArg(nombre)}','${jsArg(cel)}')">Enviar el enlace por WhatsApp</button>` : ''}
    <button class="btn btn-vidrio" onclick="cerrarHoja()">Cerrar</button>`);
  mostrarDiseno('hojaDiseno', id);
}

// ---------- Buscar ----------
function buscarEnVivo() {
  clearTimeout(busquedaTimer);
  const q = $('bQ').value.trim();
  if (q.length < 3) { $('bEstado').textContent = 'Escribe al menos 3 caracteres.'; $('bPanel').classList.add('oculto'); return; }
  $('bEstado').textContent = 'Buscando...';
  busquedaTimer = setTimeout(buscar, 450);
}
async function buscar() {
  const q = $('bQ').value.trim();
  const r = await api('buscar', { q }, true);
  if (q !== $('bQ').value.trim()) return;
  if (!r.ok) { $('bEstado').textContent = r.error; return; }
  $('bEstado').textContent = r.resultados.length ? r.resultados.length + ' resultado' + (r.resultados.length > 1 ? 's' : '') : 'Sin resultados para "' + q + '".';
  $('bPanel').classList.toggle('oculto', !r.resultados.length);
  const admin = sesion.rol === 'Administrador';
  $('bResultados').innerHTML = r.resultados.map(x => `
    <li>
      <div class="item-cab"><div><b>${esc(x.comprador) || 'Sin datos del comprador'}</b>
        <small>${x.doc ? 'Doc. ' + esc(x.doc) + ' · ' : ''}${x.celular ? 'Cel. ' + esc(x.celular) : ''}</small>
        <small>${esc(x.vendedor)}${x.nLista ? ', N° ' + esc(x.nLista) : ''} · ${esc(x.id)}${x.horaIngreso ? ' · ingresó ' + esc(x.horaIngreso) : ''}</small></div>
        <span class="estado e-${esc(x.estado)}">${estadoTexto(x.estado)}</span></div>
      <div class="item-acciones">
        ${x.estado !== 'Anulada' ? `<button onclick="verEntradaEnHoja('${jsArg(x.id)}','${jsArg(x.comprador || 'Entrada')}','${jsArg(x.celular)}','${jsArg(x.comprador)}')">Ver entrada</button>` : ''}
        ${admin && x.estado !== 'Anulada' && x.estado !== 'Usada' ? `<button class="peligro" onclick="anular('${jsArg(x.id)}')">Anular</button>` : ''}
      </div>
    </li>`).join('');
}
const estadoTexto = e => ({ Generada: 'Sin registrar', Entregada: 'Registrada', Usada: 'Ingresó', Anulada: 'Anulada' }[e] || e);
function reenviar(id, nombre, cel) {
  const msg = `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}, esta es tu entrada:\n${APP_URL}?t=${id}`;
  window.open((cel ? 'https://wa.me/51' + cel : 'https://wa.me/') + '?text=' + encodeURIComponent(msg), '_blank');
}
async function anular(id) {
  const motivo = prompt('¿Por qué se anula la entrada ' + id + '?');
  if (!motivo) return;
  if (!confirm('Se anulará ' + id + ' y ya no podrá ingresar. ¿Continuar?')) return;
  const r = await api('anular', { id, motivo });
  aviso(r.ok ? 'Entrada anulada' : r.error);
  buscar();
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
    return `<button type="button" class="ficha ${clase}" onclick="verEntradaEnHoja('${jsArg(x.id)}','Entrada N° ${jsArg(x.n)}')" aria-label="Entrada ${esc(x.n)}">${esc(x.n)}<small>${x.id.slice(0, 4)}</small></button>`;
  }).join('');
  const evento = sesion.config ? sesion.config.evento : 'el evento';
  let t = `Hola ${r.nombre.split(' ')[0]}, estos son tus códigos de entrada para ${evento}.\n` +
    `Cuando entregues una, avísanos el número de entrada y los datos del comprador (nombre, DNI y celular).\n` +
    `Cada código sirve para UNA sola persona.\n\n`;
  listaActual.qrs.forEach(q => { t += `Entrada ${q.n}: ${q.id}\n`; });
  $('lTexto').value = t;
  $('lWhats').href = 'https://wa.me/?text=' + encodeURIComponent(t);
  $('lProgreso').textContent = '';
  $('lAcceso').classList.toggle('oculto', !r.clave);
  if (r.clave) {
    $('lClave').textContent = r.clave;
    const m = `Hola ${r.nombre.split(' ')[0]}, para ver tus entradas de ${evento} entra a:\n${APP_URL}\nTu clave personal es: ${r.clave}\nNo la compartas.`;
    $('lWhatsClave').href = 'https://wa.me/?text=' + encodeURIComponent(m);
  }
  $('lSalida').classList.remove('oculto');
}
async function nuevoConcursante() {
  const nombre = $('nNombre').value.trim().replace(/\s+/g, ' ');
  const celular = $('nCel').value.replace(/\D/g, '');
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
  await cargarVendedores();
  prepararListas();
  const it = { value: r.codigo, label: r.nombre, sub: r.codigo };
  $('lConc').innerHTML = `<div class="elegido"><div><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></div><button type="button" onclick="prepararListas()">Cambiar</button></div>`;
  await armarLista(r.codigo);
  $('lAvance').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      ${x.estado !== 'Anulada' ? `<div class="item-acciones"><button onclick="verEntradaEnHoja('${jsArg(x.id)}','${x.n ? 'Entrada N° ' + jsArg(x.n) : 'Entrada'}')">Ver entrada</button></div>` : ''}
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
    <div class="vidrio panel"><h3>Caja en puerta</h3><div class="datos">${(Object.keys(s.caja).map(m => fila(m, s.caja[m])).join('') || fila('Ventas', 0)) + fila('Total cobrado', 'S/ ' + s.montoCaja)}</div>
    <p class="nota">El detalle completo y las ventas de concursantes están en la hoja de Google.</p></div>`;
}

// ---------- Diseño de la entrada ----------
const PLANTILLA = 'entrada.jpg';
const PLANTILLA_ANCHO = 941, PLANTILLA_ALTO = 1672;
const CAJA_QR = { x: 371, y: 1266, w: 199, h: 196 };   // recuadro claro del diseño donde va el QR

function cargarPlantilla() {
  if (!plantillaPromesa) {
    plantillaPromesa = new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => { plantillaPromesa = null; mal(new Error('No se encontró el diseño de la entrada')); };
      i.src = PLANTILLA;
    });
  }
  return plantillaPromesa;
}
function matrizQR(texto) {
  const q = new QRCode(document.createElement('div'), { text: texto, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M });
  const m = q._oQRCode, n = m.getModuleCount(), out = [];
  for (let r = 0; r < n; r++) { const fila = []; for (let c = 0; c < n; c++) fila.push(m.isDark(r, c)); out.push(fila); }
  return out;
}
async function crearEntrada(id) {
  const img = await cargarPlantilla();
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const sx = cv.width / PLANTILLA_ANCHO, sy = cv.height / PLANTILLA_ALTO;
  const B = { x: CAJA_QR.x * sx, y: CAJA_QR.y * sy, w: CAJA_QR.w * sx, h: CAJA_QR.h * sy };
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(B.x, B.y, B.w, B.h);
  const m = matrizQR(id), n = m.length;
  const cel = Math.floor(Math.min(B.w, B.h) * 0.8 / n), lado = cel * n;
  const x0 = Math.round(B.x + (B.w - lado) / 2), y0 = Math.round(B.y + B.h * 0.05);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) ctx.fillRect(x0 + c * cel, y0 + r * cel, cel, cel);
  ctx.font = `bold ${Math.round(B.h * 0.085)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(id, B.x + B.w / 2, B.y + B.h * 0.94);
  return cv;
}
async function mostrarDiseno(idCont, id) {
  const cont = $(idCont);
  try {
    const cv = await crearEntrada(id);
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
      const cv = await crearEntrada(q.id);
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

// ---------- Entrada pública ----------
async function verTicket(id) {
  $('subtituloMarca').textContent = 'Tu entrada';
  mostrar('ticket');
  const r = await api('ticket', { id });
  if (!r.ok || r.estado === 'Anulada') {
    $('tError').textContent = r.ok ? 'Esta entrada fue anulada. Comunícate con la organización.' : r.error;
    $('tDiseno').innerHTML = '';
  } else if (await mostrarDiseno('tDiseno', id)) {
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
  let guardada = null;
  try { guardada = localStorage.getItem('clave'); } catch (e) {}
  if (guardada) {
    mostrar('login');
    sesion = { clave: guardada };
    const r = await api('login');
    if (r.ok) { iniciarSesion(guardada, r); return; }
    sesion = null;
  }
  mostrar('login');
})();
