/* Pruebas del motor de áreas (sin DOM).
 * Ejecutar con: node tests/areas.test.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

global.window = global;

var storage = {};
global.localStorage = {
  getItem: function (key) {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  },
  setItem: function (key, value) {
    storage[key] = String(value);
  },
  removeItem: function (key) {
    delete storage[key];
  }
};

global.AUTEC = {
  store: {
    companies: [
      { id: 'hotel-alba', name: 'Hotel Alba', skills: ['mesas', 'barra', 'aforo-salas'] },
      { id: 'planta-sur', name: 'Planta Sur', skills: ['puestos-libres'] },
      { id: 'clinica-valle', name: 'Clínica del Valle', skills: ['aforo-salas'] },
      { id: 'constructora-andes', name: 'Constructora Andes', skills: ['aforo-aulas'] },
      { id: 'cim', name: 'CIM Seguridad', skills: ['aglomeraciones'] }
    ],
    monitoring: { people: [] }
  },
  icon: function () { return ''; }
};

var source = fs.readFileSync(path.join(__dirname, '..', 'mockup', 'js', 'areas.js'), 'utf8');
vm.runInThisContext(source, { filename: 'areas.js' });

var A = AUTEC.areas;

function detection(x1, y1, x2, y2) {
  return { x1: x1, y1: y1, x2: x2, y2: y2 };
}

function fullArea(id, capacity, name) {
  return { id: id, name: name || id, capacity: capacity, x: 0, y: 0, w: 1, h: 1 };
}

function evaluate(skillId, companyId, detections, now) {
  return A.evaluate(skillId, detections, 100, 100, now, { companyId: companyId });
}

/* 1. Catálogo de las cinco skills y asignación por empresa */
assert.deepStrictEqual(
  A.skillIds(),
  ['barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones']
);
A.skillIds().forEach(function (skillId) {
  assert.ok(A.definition(skillId), 'Falta la definición de ' + skillId);
  assert.strictEqual(A.definition(skillId).id, skillId);
});
assert.strictEqual(A.hasSkill('barra', 'hotel-alba'), true);
assert.strictEqual(A.hasSkill('barra', 'cim'), false);
assert.strictEqual(A.hasSkill('aglomeraciones', 'cim'), true);
assert.strictEqual(A.config('barra', 'hotel-alba').areas.length, 2);
assert.strictEqual(A.config('aforo-salas', 'clinica-valle').areas.length, 3);

/* 2. Barra: ocupación, espera objetivo y enfriamiento */
A.update('barra', 'hotel-alba', {
  enabled: true,
  waitSeconds: 60,
  cooldownSeconds: 120,
  areas: [fullArea('barra-test', 2, 'Barra test')]
});
var barra1 = evaluate('barra', 'hotel-alba', [detection(40, 40, 60, 92)], 1000);
assert.strictEqual(barra1.stats.persons, 1);
assert.strictEqual(barra1.stats.areas['barra-test'].count, 1);
assert.strictEqual(barra1.stats.areas['barra-test'].attention, false);
assert.strictEqual(barra1.events.length, 0);

var barra2 = evaluate('barra', 'hotel-alba', [detection(40, 40, 60, 92)], 61000);
assert.strictEqual(barra2.stats.areas['barra-test'].attention, true);
assert.strictEqual(barra2.stats.areas['barra-test'].alert, true);
assert.strictEqual(barra2.events.length, 1);
assert.ok(barra2.events[0].text.indexOf('espera') !== -1);
assert.strictEqual(barra2.events[0].skillId, 'barra');

var barra3 = evaluate('barra', 'hotel-alba', [detection(40, 40, 60, 92)], 62000);
assert.strictEqual(barra3.events.length, 0, 'El enfriamiento debe evitar alertas repetidas');

var barra4 = evaluate('barra', 'hotel-alba', [detection(40, 40, 60, 92)], 182000);
assert.strictEqual(barra4.events.length, 1, 'La alerta debe repetirse al vencer el enfriamiento');

var barra5 = evaluate('barra', 'hotel-alba', [], 190000);
assert.strictEqual(barra5.stats.persons, 0);
assert.strictEqual(barra5.stats.areas['barra-test'].status, 'free');

/* 3. Aforo de salas: alerta sostenida por gracia */
A.update('aforo-salas', 'clinica-valle', {
  enabled: true,
  graceSeconds: 2,
  cooldownSeconds: 60,
  areas: [fullArea('sala-test', 2, 'Sala test')]
});
var sala1 = evaluate('aforo-salas', 'clinica-valle', [
  detection(10, 40, 20, 90),
  detection(45, 40, 55, 90),
  detection(75, 40, 85, 90)
], 5000);
assert.strictEqual(sala1.stats.areas['sala-test'].count, 3);
assert.strictEqual(sala1.stats.overCapacity, 1);
assert.strictEqual(sala1.stats.areas['sala-test'].attention, true);
assert.strictEqual(sala1.stats.areas['sala-test'].alert, false);
assert.strictEqual(sala1.events.length, 0);

var sala2 = evaluate('aforo-salas', 'clinica-valle', [
  detection(10, 40, 20, 90),
  detection(45, 40, 55, 90),
  detection(75, 40, 85, 90)
], 8000);
assert.strictEqual(sala2.stats.areas['sala-test'].alert, true);
assert.strictEqual(sala2.events.length, 1);
assert.ok(sala2.events[0].text.indexOf('aforo excedido') !== -1);

/* 4. Puestos libres: ocupados, libres y capacidad */
A.update('puestos-libres', 'planta-sur', {
  enabled: true,
  graceSeconds: 5,
  areas: [
    { id: 'p1', name: 'Puesto 1', capacity: 1, x: 0, y: 0, w: 0.3, h: 1 },
    { id: 'p2', name: 'Puesto 2', capacity: 1, x: 0.35, y: 0, w: 0.3, h: 1 },
    { id: 'p3', name: 'Puesto 3', capacity: 1, x: 0.7, y: 0, w: 0.3, h: 1 }
  ]
});
var puestos = evaluate('puestos-libres', 'planta-sur', [
  detection(10, 40, 20, 90)
], 1000);
assert.strictEqual(puestos.stats.persons, 1);
assert.strictEqual(puestos.stats.occupiedAreas, 1);
assert.strictEqual(puestos.stats.freeAreas, 2);
assert.strictEqual(puestos.stats.capacity, 3);
assert.strictEqual(puestos.stats.freeCapacity, 2);
assert.strictEqual(puestos.stats.areas.p1.status, 'occupied');
assert.strictEqual(puestos.stats.areas.p3.status, 'free');
assert.strictEqual(puestos.events.length, 0);

/* 5. Aglomeraciones: umbral alcanzado y gracia */
A.update('aglomeraciones', 'cim', {
  enabled: true,
  graceSeconds: 3,
  cooldownSeconds: 60,
  areas: [fullArea('acceso-test', 2, 'Acceso test')]
});
var crowd1 = evaluate('aglomeraciones', 'cim', [
  detection(20, 40, 30, 90),
  detection(70, 40, 80, 90)
], 1000);
assert.strictEqual(crowd1.stats.areas['acceso-test'].count, 2);
assert.strictEqual(crowd1.stats.areas['acceso-test'].attention, true);
assert.strictEqual(crowd1.stats.areas['acceso-test'].alert, false);
assert.strictEqual(crowd1.events.length, 0);

var crowd2 = evaluate('aglomeraciones', 'cim', [
  detection(20, 40, 30, 90),
  detection(70, 40, 80, 90)
], 5000);
assert.strictEqual(crowd2.stats.areas['acceso-test'].alert, true);
assert.strictEqual(crowd2.events.length, 1);
assert.ok(crowd2.events[0].text.indexOf('aglomeración') !== -1);

/* 6. Actualización con límites y persistencia */
var clamps = A.update('aforo-aulas', 'constructora-andes', {
  waitSeconds: 1,
  graceSeconds: 999,
  cooldownSeconds: 1,
  areas: [fullArea('aula-test', 999, 'Aula test')]
});
assert.strictEqual(clamps.waitSeconds, 30);
assert.strictEqual(clamps.graceSeconds, 120);
assert.strictEqual(clamps.cooldownSeconds, 10);
assert.strictEqual(clamps.areas[0].capacity, 200);
assert.ok(localStorage.getItem(A.storageKey).indexOf('aforo-aulas') !== -1);

/* 7. Reset de runtime */
evaluate('aforo-aulas', 'constructora-andes', [detection(40, 40, 60, 90)], 1000);
assert.ok(A.stats('aforo-aulas', 'constructora-andes'));
A.reset('aforo-aulas', 'constructora-andes');
assert.strictEqual(A.stats('aforo-aulas', 'constructora-andes'), null);

/* 8. Preview simulado marcado */
var preview = A.previewStats('barra', 'hotel-alba');
assert.strictEqual(preview.simulated, true);
assert.strictEqual(preview.source, 'demo');
assert.ok(preview.persons > 0);
assert.ok(preview.alerts >= 1);

/* 9. Desactivar una skill no cuenta personas */
A.update('barra', 'hotel-alba', { enabled: false });
var disabled = evaluate('barra', 'hotel-alba', [detection(40, 40, 60, 92)], 200000);
assert.strictEqual(disabled.stats.source, 'disabled');
assert.strictEqual(disabled.stats.persons, 0);
assert.strictEqual(disabled.events.length, 0);

console.log('areas.test.js: 9 pruebas OK');
