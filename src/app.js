const Fastify = require('fastify');

const computerSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['serial_number', 'machine_type', 'office'],
  properties: {
    serial_number: { type: 'string', minLength: 1, maxLength: 255 },
    serial_override: { type: 'string', maxLength: 255 },
    manufacturer: { type: 'string', maxLength: 255 },
    model: { type: 'string', maxLength: 255 },
    operating_system: { type: 'string', maxLength: 255 },
    processor: { type: 'string', maxLength: 65535 }, storage: { type: 'string', maxLength: 65535 },
    memory: { type: 'string', maxLength: 255 }, gpu: { type: 'string', maxLength: 65535 },
    mac_address: { type: 'string', maxLength: 255 }, details: { type: 'string', maxLength: 65535 },
    hostname: { type: 'string', maxLength: 255 }, username: { type: 'string', maxLength: 255 },
    machine_type: { type: 'string', minLength: 1, maxLength: 100 },
    // The client permits an acquisition year, year-month, or full calendar date.
    acquired_on: { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' }, office: { type: 'string', minLength: 1, maxLength: 255 },
    par_holder: { type: 'string', maxLength: 255 }, primary_user: { type: 'string', maxLength: 255 },
    remarks: { type: 'string', maxLength: 65535 }, collected_on: { type: 'string', format: 'date-time' },
    script_version: { type: 'string', maxLength: 100 }
  }
};

const columns = Object.keys(computerSchema.properties);
const updateColumns = columns.filter((column) => column !== 'serial_number')
  .map((column) => `${column} = VALUES(${column})`).join(', ');

function toMysqlDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function toMysqlAcquiredOn(value) {
  if (!value) return null;
  const text = String(value).trim();
  const dateText = /^\d{4}$/.test(text) ? `${text}-01-01`
    : /^\d{4}-\d{2}$/.test(text) ? `${text}-01`
      : text;
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== dateText) {
    const error = new Error('acquired_on must be a year, year-month, or YYYY-MM-DD date.');
    error.statusCode = 400;
    throw error;
  }
  return dateText;
}

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function buildApp({ pool, logger = true }) {
  const app = Fastify({ logger });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });

  app.post('/api/computers', { schema: { body: computerSchema } }, async (request, reply) => {
    const body = request.body;
    const values = columns.map((column) => {
      if (column === 'collected_on') return toMysqlDate(body.collected_on || new Date().toISOString());
      if (column === 'acquired_on') return toMysqlAcquiredOn(body.acquired_on);
      return cleanValue(body[column] ?? null);
    });
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO computers (${columns.join(', ')}) VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateColumns}`;
    const [result] = await pool.execute(sql, values);
    const [rows] = await pool.execute('SELECT * FROM computers WHERE serial_number = ?', [values[0]]);
    reply.code(result.affectedRows === 1 ? 201 : 200);
    return { computer: rows[0], created: result.affectedRows === 1 };
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (error.validation) return reply.code(400).send({ error: 'Invalid request', details: error.validation });
    if (error.statusCode === 400) return reply.code(400).send({ error: error.message });
    return reply.code(500).send({ error: 'Internal server error' });
  });
  return app;
}

module.exports = { buildApp };
