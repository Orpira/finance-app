import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

const apiBase = (process.env.N8N_API_URL || 'https://n8n.orpira.es/api/v1').replace(/\/$/, '')
const apiKey = process.env.N8N_API_KEY?.trim()
const apply = process.argv.includes('--apply')

const WORKFLOW_NAME = 'Private Balance - Nuevo Ingreso'
const IDEMPOTENCY_NODE_NAMES = new Set([
  'Controlar Evento Idempotente',
  'Enrutar Idempotencia',
  'Restaurar Evento Nuevo',
  'Respuesta Evento Duplicado',
  'Respuesta Idempotencia Conflict',
  'Respond Conflict',
  'Marcar Evento Procesado',
  'Restaurar Respuesta Final',
])

if (!apiKey) throw new Error('N8N_API_KEY no está configurado.')

const headers = { 'Content-Type': 'application/json', 'X-N8N-API-KEY': apiKey }

async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`n8n ${response.status}: ${body.message ?? JSON.stringify(body)}`)
  return body
}

function updatePayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: { executionOrder: workflow.settings?.executionOrder ?? 'v1' },
  }
}

function removeNode(workflow, name) {
  workflow.nodes = workflow.nodes.filter((node) => node.name !== name)
  delete workflow.connections[name]
  for (const connection of Object.values(workflow.connections)) {
    for (const outputs of connection.main ?? []) {
      for (let index = outputs.length - 1; index >= 0; index -= 1) {
        if (outputs[index].node === name) outputs.splice(index, 1)
      }
    }
  }
}

function connect(workflow, source, outputIndex, target) {
  workflow.connections[source] ??= { main: [] }
  workflow.connections[source].main ??= []
  workflow.connections[source].main[outputIndex] = [{ node: target, type: 'main', index: 0 }]
}

function codeNode(name, position, jsCode) {
  return {
    id: `pb-idempotency-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: { jsCode },
  }
}

function postgresNode(name, position, sourceNode, query) {
  return {
    id: `pb-idempotency-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    type: sourceNode.type,
    typeVersion: sourceNode.typeVersion,
    position,
    parameters: {
      operation: 'executeQuery',
      query,
      options: {},
    },
    credentials: sourceNode.credentials,
  }
}

function switchNode(name, position) {
  return {
    id: 'pb-idempotency-router',
    name,
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.4,
    position,
    parameters: {
      rules: {
        values: ['new', 'duplicate', 'conflict'].map((value, index) => ({
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
            conditions: [{
              id: `idempotency-${index}`,
              leftValue: '={{ $json.idempotency_status }}',
              rightValue: value,
              operator: { type: 'string', operation: 'equals' },
            }],
            combinator: 'and',
          },
        })),
      },
      options: {},
    },
  }
}

function respondNode(name, position, responseCode) {
  return {
    id: `pb-idempotency-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position,
    parameters: {
      options: { responseCode },
    },
  }
}

const normalizeGatewayEnvelopeCode = `
const body = $json.body || $json;
const headers = $json.headers || {};

if (!body.event) {
  throw new Error('Missing event');
}

const eventId =
  headers['x-private-balance-event-id'] ||
  headers['idempotency-key'] ||
  body.eventId;

if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
  throw new Error('Missing or invalid eventId');
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const next = value[key];
        if (next !== undefined) acc[key] = normalizeValue(next);
        return acc;
      }, {});
  }
  return value === undefined ? null : value;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words = [];
  const asciiBitLength = ascii.length * 8;
  const initialHash = sha256.h = sha256.h || [];
  const k = sha256.k = sha256.k || [];
  let primeCounter = k.length;
  const isComposite = {};

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      initialHash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }
  let hash = initialHash.slice(0, 8);

  ascii += '\\x80';
  while (ascii.length % 64 - 56) ascii += '\\x00';
  for (let i = 0; i < ascii.length; i += 1) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) throw new Error('ASCII-only SHA256 input expected');
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i += 1) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

const normalizedPayload = normalizeValue({
  event: body.event,
  source: body.source || 'private-balance-pwa',
  createdAt: body.createdAt || null,
  schemaVersion: body.schemaVersion || null,
  data: body.data || null,
  userCode: body.userCode || null,
  deviceCode: body.deviceCode || body.data?.deviceCode || null,
  timezone: body.timezone || null,
  locale: body.locale || null,
});
const payload_hash = sha256(unescape(encodeURIComponent(JSON.stringify(normalizedPayload))));

return [
  {
    json: {
      ...body,
      eventId,
      source: body.source || 'private-balance-pwa',
      payload_hash,
      normalized_payload: normalizedPayload,
      origin_ip: headers['x-real-ip'] || headers['x-forwarded-for'] || null,
    },
  },
];`

const claimEventQuery = `
CREATE TABLE IF NOT EXISTS processed_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  source text,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS processed_events_event_type_created_at_idx
  ON processed_events (event_type, created_at DESC);
WITH incoming AS (
  SELECT
    '{{ $("Code in JavaScript").first().json.eventId }}'::text AS event_id,
    '{{ $("Code in JavaScript").first().json.event.replaceAll("'", "''") }}'::text AS event_type,
    '{{ ($("Code in JavaScript").first().json.source || "private-balance-pwa").replaceAll("'", "''") }}'::text AS source,
    '{{ $("Code in JavaScript").first().json.payload_hash }}'::text AS payload_hash
),
inserted AS (
  INSERT INTO processed_events (event_id, event_type, source, payload_hash, status)
  SELECT event_id, event_type, source, payload_hash, 'processing'
  FROM incoming
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id, event_id, event_type, source, payload_hash, status, created_at, processed_at
),
matched AS (
  SELECT pe.*
  FROM processed_events pe
  JOIN incoming i ON i.event_id = pe.event_id
)
SELECT
  COALESCE(inserted.id, matched.id) AS id,
  incoming.event_id,
  incoming.event_type,
  incoming.source,
  incoming.payload_hash,
  matched.payload_hash AS existing_payload_hash,
  COALESCE(inserted.status, matched.status) AS status,
  COALESCE(inserted.created_at, matched.created_at) AS created_at,
  COALESCE(inserted.processed_at, matched.processed_at) AS processed_at,
  CASE
    WHEN inserted.id IS NOT NULL THEN 'new'
    WHEN matched.payload_hash = incoming.payload_hash THEN 'duplicate'
    ELSE 'conflict'
  END AS idempotency_status
FROM incoming
LEFT JOIN inserted ON true
LEFT JOIN matched ON true;`

const restoreNewEventCode = `
const envelope = $('Code in JavaScript').first().json;
const idempotency = $('Controlar Evento Idempotente').first().json;
return [{ json: { ...envelope, processedEventId: idempotency.id } }];`

const duplicateResponseCode = `
const event = $('Controlar Evento Idempotente').first().json;
return [{
  json: {
    success: true,
    duplicate: true,
    eventId: event.event_id,
    message: 'Event already processed.',
  },
}];`

const conflictResponseCode = `
const event = $('Controlar Evento Idempotente').first().json;
return [{
  json: {
    success: false,
    duplicate: false,
    eventId: event.event_id,
    error: 'Event already exists with different payload.',
  },
}];`

const markProcessedQuery = `
UPDATE processed_events
SET status = 'processed',
    processed_at = COALESCE(processed_at, now())
WHERE event_id = '{{ $("Code in JavaScript").first().json.eventId }}'
RETURNING id, event_id, status, processed_at;`

const restoreFinalResponseCode = `
const responseNodes = [
  'Respuesta OK',
  'Respuesta OK1',
  'Respuesta sin canal WhatsApp Ingreso',
  'Respuesta sin canal WhatsApp Egreso',
];

for (const nodeName of responseNodes) {
  try {
    const item = $(nodeName).first().json;
    if (item && Object.keys(item).length > 0) {
      return [{ json: item }];
    }
  } catch {}
}

return [{
  json: {
    success: true,
    code: 200,
    event: $('Code in JavaScript').first().json.event,
    message: 'Operation completed successfully',
    timestamp: new Date().toISOString(),
  },
}];`

function routeExistingRespondsThroughProcessedMarker(workflow) {
  for (const [source, connection] of Object.entries(workflow.connections)) {
    if (IDEMPOTENCY_NODE_NAMES.has(source)) continue
    for (const outputs of connection.main ?? []) {
      for (const target of outputs) {
        if (target.node === 'Respond to Webhook') {
          target.node = 'Marcar Evento Procesado'
        }
      }
    }
  }
}

function repairEventSwitchRouting(workflow) {
  const eventSwitch = workflow.nodes.find((node) => node.name === 'Switch')
  const values = eventSwitch?.parameters?.rules?.values
  if (!Array.isArray(values)) return

  for (const rule of values) {
    const condition = rule.conditions?.conditions?.[0]
    if (
      condition?.rightValue === 'income.created' ||
      condition?.rightValue === 'expense.created' ||
      condition?.rightValue === 'calendar.created' ||
      condition?.rightValue === 'backup.run' ||
      condition?.rightValue === 'communication.whatsapp.qr.requested'
    ) {
      condition.leftValue = '={{ $json.request_payload?.event || $json.event || $("Code in JavaScript").first().json.event }}'
    }
  }
}

function applyIdempotencyBarrier(workflow) {
  for (const name of IDEMPOTENCY_NODE_NAMES) removeNode(workflow, name)

  const webhookNode = workflow.nodes.find((node) => node.name === 'Webhook')
  const normalizeNode = workflow.nodes.find((node) => node.name === 'Code in JavaScript')
  const eventLogNode = workflow.nodes.find((node) => node.name === 'Registrar Event Log')
  const respondNodeCurrent = workflow.nodes.find((node) => node.name === 'Respond to Webhook')

  if (!webhookNode || !normalizeNode || !eventLogNode || !respondNodeCurrent) {
    throw new Error('No se encontraron los nodos base del workflow de automatización.')
  }
  if (!eventLogNode.credentials) {
    throw new Error('Registrar Event Log no tiene credenciales Postgres configuradas.')
  }

  normalizeNode.parameters = { jsCode: normalizeGatewayEnvelopeCode }
  repairEventSwitchRouting(workflow)

  const claimNode = postgresNode('Controlar Evento Idempotente', [-520, 0], eventLogNode, claimEventQuery)
  const routerNode = switchNode('Enrutar Idempotencia', [-300, 0])
  const restoreNode = codeNode('Restaurar Evento Nuevo', [-80, -160], restoreNewEventCode)
  const duplicateNode = codeNode('Respuesta Evento Duplicado', [-80, 40], duplicateResponseCode)
  const conflictNode = codeNode('Respuesta Idempotencia Conflict', [-80, 220], conflictResponseCode)
  const conflictRespondNode = respondNode('Respond Conflict', [160, 220], 409)
  const markProcessedNode = postgresNode('Marcar Evento Procesado', [1820, 80], eventLogNode, markProcessedQuery)
  const restoreResponseNode = codeNode('Restaurar Respuesta Final', [2040, 80], restoreFinalResponseCode)

  workflow.nodes.push(
    claimNode,
    routerNode,
    restoreNode,
    duplicateNode,
    conflictNode,
    conflictRespondNode,
    markProcessedNode,
    restoreResponseNode,
  )

  routeExistingRespondsThroughProcessedMarker(workflow)

  connect(workflow, 'Webhook', 0, 'Code in JavaScript')
  connect(workflow, 'Code in JavaScript', 0, 'Controlar Evento Idempotente')
  connect(workflow, 'Controlar Evento Idempotente', 0, 'Enrutar Idempotencia')
  workflow.connections['Enrutar Idempotencia'] = {
    main: [
      [{ node: 'Restaurar Evento Nuevo', type: 'main', index: 0 }],
      [{ node: 'Respuesta Evento Duplicado', type: 'main', index: 0 }],
      [{ node: 'Respuesta Idempotencia Conflict', type: 'main', index: 0 }],
    ],
  }
  connect(workflow, 'Restaurar Evento Nuevo', 0, 'Registrar Event Log')
  connect(workflow, 'Respuesta Evento Duplicado', 0, 'Respond to Webhook')
  connect(workflow, 'Respuesta Idempotencia Conflict', 0, 'Respond Conflict')
  connect(workflow, 'Marcar Evento Procesado', 0, 'Restaurar Respuesta Final')
  connect(workflow, 'Restaurar Respuesta Final', 0, 'Respond to Webhook')

  for (const responseNodeName of [
    'Respuesta OK',
    'Respuesta OK1',
    'Respuesta sin canal WhatsApp Ingreso',
    'Respuesta sin canal WhatsApp Egreso',
  ]) {
    if (workflow.nodes.some((node) => node.name === responseNodeName)) {
      connect(workflow, responseNodeName, 0, 'Marcar Evento Procesado')
    }
  }

  return workflow
}

const workflowList = await request('/workflows?limit=100')
const summary = workflowList.data.find((workflow) => workflow.name === WORKFLOW_NAME)
if (!summary) throw new Error(`No existe el workflow ${WORKFLOW_NAME}.`)

const current = await request(`/workflows/${summary.id}`)
const updatedWorkflow = applyIdempotencyBarrier(structuredClone(current))

if (apply) {
  const updated = await request(`/workflows/${current.id}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload(updatedWorkflow)),
  })
  console.log(JSON.stringify({
    mode: 'applied',
    workflow: {
      id: updated.id,
      name: updated.name,
      active: updated.active,
      updatedAt: updated.updatedAt,
    },
  }, null, 2))
} else {
  console.log(JSON.stringify({
    mode: 'dry-run',
    workflow: {
      id: current.id,
      name: current.name,
      nodes: updatedWorkflow.nodes.length,
      idempotencyNodes: [...IDEMPOTENCY_NODE_NAMES],
    },
  }, null, 2))
}
