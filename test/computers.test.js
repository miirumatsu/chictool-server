const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');

test('POST /api/computers inserts a computer and normalizes string values', async (t) => {
  let insertValues;
  const pool = {
    execute: async (sql, values) => {
      if (sql.startsWith('INSERT')) {
        insertValues = values;
        return [{ affectedRows: 1 }];
      }
      return [[{ id: 7, serial_number: values[0] }]];
    },
    query: async () => []
  };
  const app = buildApp({ pool, logger: false });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/api/computers',
    payload: { serial_number: ' SN-01 ', machine_type: 'Laptop', office: 'HQ' }
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { computer: { id: 7, serial_number: 'SN-01' }, created: true });
  assert.equal(insertValues[0], 'SN-01');
});

test('POST /api/computers rejects incomplete requests', async (t) => {
  const app = buildApp({ pool: { query: async () => [], execute: async () => [] }, logger: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/computers', payload: { serial_number: 'SN-01' } });
  assert.equal(response.statusCode, 400);
});

test('POST /api/computers accepts a year-only acquired_on value', async (t) => {
  let insertValues;
  const pool = {
    execute: async (sql, values) => {
      if (sql.startsWith('INSERT')) { insertValues = values; return [{ affectedRows: 1 }]; }
      return [[{ id: 8, serial_number: values[0] }]];
    }, query: async () => []
  };
  const app = buildApp({ pool, logger: false });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST', url: '/api/computers',
    payload: { serial_number: 'SN-02', machine_type: 'Laptop', office: 'HQ', acquired_on: '2026' }
  });
  assert.equal(response.statusCode, 201);
  assert.equal(insertValues[14], '2026-01-01');
});
