import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { canonicalJsonHash } from "./canonical-json.mjs";
import { closePool, getPool } from "./db.mjs";
import {
  HttpError,
  buildCorrelationId,
  buildTraceId,
  ensureObject,
  errorBody,
  isUuid,
  lowerHeader,
  nowIso,
  parseJsonBody,
  requireHeader,
  requireUuidField,
  sendJson,
} from "./http-utils.mjs";
import {
  getCommandEndpointPolicy,
  isRoleAllowedForCommandEndpoint,
  isToolAllowedForCommandEndpoint,
} from "../../shared/authorization-policy.mjs";
import {
  IncidentTemplatePolicyError,
  evaluateCloseoutRequirements,
} from "../../workflow-engine/rules/closeout-required-evidence.mjs";

const ticketRouteRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function emitStructuredLog(logger, level, payload) {
  const line = JSON.stringify({
    level,
    service: "dispatch-api",
    ...payload,
  });

  if (level === "error") {
    if (logger && typeof logger.error === "function") {
      logger.error(line);
      return;
    }
    console.error(line);
    return;
  }

  if (logger && typeof logger.info === "function") {
    logger.info(line);
    return;
  }
  if (logger && typeof logger.log === "function") {
    logger.log(line);
    return;
  }
  console.log(line);
}

function createMetricsRegistry() {
  const requestsTotal = new Map();
  const errorsTotal = new Map();
  const transitionsTotal = new Map();
  let idempotencyReplayTotal = 0;
  let idempotencyConflictTotal = 0;

  function incrementCounter(map, key) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return {
    incrementRequest(method, endpoint, status) {
      const key = JSON.stringify([String(method), String(endpoint), Number(status)]);
      incrementCounter(requestsTotal, key);
    },
    incrementError(code) {
      const normalized = typeof code === "string" && code.trim() !== "" ? code.trim() : "UNKNOWN_ERROR";
      incrementCounter(errorsTotal, normalized);
    },
    incrementTransition(fromState, toState) {
      const key = JSON.stringify([fromState ?? null, toState ?? null]);
      incrementCounter(transitionsTotal, key);
    },
    incrementIdempotencyReplay() {
      idempotencyReplayTotal += 1;
    },
    incrementIdempotencyConflict() {
      idempotencyConflictTotal += 1;
    },
    snapshot() {
      const requests = Array.from(requestsTotal.entries())
        .map(([key, count]) => {
          const [method, endpoint, status] = JSON.parse(key);
          return {
            method,
            endpoint,
            status: Number(status),
            count,
          };
        })
        .sort(
          (left, right) =>
            left.method.localeCompare(right.method) ||
            left.endpoint.localeCompare(right.endpoint) ||
            left.status - right.status,
        );

      const errors = Array.from(errorsTotal.entries())
        .map(([code, count]) => ({
          code,
          count,
        }))
        .sort((left, right) => left.code.localeCompare(right.code));

      const transitions = Array.from(transitionsTotal.entries())
        .map(([key, count]) => {
          const [fromState, toState] = JSON.parse(key);
          return {
            from_state: fromState,
            to_state: toState,
            count,
          };
        })
        .sort((left, right) => {
          const leftFrom = left.from_state ?? "";
          const rightFrom = right.from_state ?? "";
          const fromOrder = leftFrom.localeCompare(rightFrom);
          if (fromOrder !== 0) {
            return fromOrder;
          }

          const leftTo = left.to_state ?? "";
          const rightTo = right.to_state ?? "";
          return leftTo.localeCompare(rightTo);
        });

      return {
        service: "dispatch-api",
        generated_at: nowIso(),
        counters: {
          requests_total: requests,
          errors_total: errors,
          transitions_total: transitions,
          idempotency_replay_total: idempotencyReplayTotal,
          idempotency_conflict_total: idempotencyConflictTotal,
        },
      };
    },
  };
}

function serializeTicket(row) {
  return {
    id: row.id,
    account_id: row.account_id,
    site_id: row.site_id,
    asset_id: row.asset_id,
    state: row.state,
    priority: row.priority,
    incident_type: row.incident_type,
    summary: row.summary,
    description: row.description,
    nte_cents: Number(row.nte_cents),
    scheduled_start: row.scheduled_start ? new Date(row.scheduled_start).toISOString() : null,
    scheduled_end: row.scheduled_end ? new Date(row.scheduled_end).toISOString() : null,
    assigned_provider_id: row.assigned_provider_id,
    assigned_tech_id: row.assigned_tech_id,
    version: Number(row.version),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function serializeAuditEvent(row) {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    actor_role: row.actor_role,
    tool_name: row.tool_name,
    request_id: row.request_id,
    correlation_id: row.correlation_id,
    trace_id: row.trace_id,
    before_state: row.before_state,
    after_state: row.after_state,
    payload: row.payload,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function serializeEvidenceItem(row) {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    kind: row.kind,
    uri: row.uri,
    checksum: row.checksum,
    metadata: row.metadata ?? {},
    created_by: row.created_by,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function getCommandPolicy(endpoint) {
  const policy = getCommandEndpointPolicy(endpoint);
  if (!policy) {
    throw new HttpError(500, "INTERNAL_ERROR", "Missing command authorization policy");
  }
  return policy;
}

function parseActorFromHeaders(headers, endpoint) {
  const policy = getCommandPolicy(endpoint);
  const actorId = requireHeader(
    headers,
    "x-actor-id",
    "MISSING_ACTOR_CONTEXT",
    "Header 'X-Actor-Id' is required",
  );
  const actorRole = requireHeader(
    headers,
    "x-actor-role",
    "MISSING_ACTOR_CONTEXT",
    "Header 'X-Actor-Role' is required",
  ).toLowerCase();
  const actorTypeRaw = lowerHeader(headers, "x-actor-type");
  const actorType = actorTypeRaw ? actorTypeRaw.trim().toUpperCase() : "HUMAN";
  const toolNameHeader = lowerHeader(headers, "x-tool-name");
  const toolName = toolNameHeader?.trim() || policy.default_tool_name;

  if (!["HUMAN", "AGENT", "SERVICE", "SYSTEM"].includes(actorType)) {
    throw new HttpError(400, "INVALID_ACTOR_CONTEXT", "Header 'X-Actor-Type' must be valid");
  }

  if (!isRoleAllowedForCommandEndpoint(endpoint, actorRole)) {
    throw new HttpError(403, "FORBIDDEN", `Actor role '${actorRole}' is not allowed for endpoint`);
  }

  if (!isToolAllowedForCommandEndpoint(endpoint, toolName)) {
    throw new HttpError(403, "TOOL_NOT_ALLOWED", `Tool '${toolName}' is not allowed for endpoint`, {
      endpoint,
      tool_name: toolName,
    });
  }

  return {
    actorId,
    actorRole,
    actorType,
    toolName,
  };
}

function parseIdempotencyKey(headers) {
  const requestId = lowerHeader(headers, "idempotency-key");
  if (!requestId || requestId.trim() === "") {
    throw new HttpError(
      400,
      "MISSING_IDEMPOTENCY_KEY",
      "Header 'Idempotency-Key' is required for command endpoints",
    );
  }

  if (!isUuid(requestId.trim())) {
    throw new HttpError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Header 'Idempotency-Key' must be a valid UUID",
    );
  }

  return requestId.trim();
}

async function insertAuditEvent(client, params) {
  const {
    ticketId,
    beforeState,
    afterState,
    actorType,
    actorId,
    actorRole,
    toolName,
    requestId,
    correlationId,
    traceId,
    payload,
  } = params;

  const auditResult = await client.query(
    `
      INSERT INTO audit_events (
        ticket_id,
        actor_type,
        actor_id,
        actor_role,
        tool_name,
        request_id,
        correlation_id,
        trace_id,
        before_state,
        after_state,
        payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `,
    [
      ticketId,
      actorType,
      actorId,
      actorRole,
      toolName,
      requestId,
      correlationId,
      traceId,
      beforeState,
      afterState,
      payload,
    ],
  );

  return auditResult.rows[0].id;
}

async function insertAuditAndTransition(client, params) {
  const {
    ticketId,
    beforeState,
    afterState,
    metrics,
  } = params;
  const auditEventId = await insertAuditEvent(client, params);
  await client.query(
    `
      INSERT INTO ticket_state_transitions (
        ticket_id,
        from_state,
        to_state,
        audit_event_id
      )
      VALUES ($1,$2,$3,$4)
    `,
    [ticketId, beforeState, afterState, auditEventId],
  );

  if (metrics && typeof metrics.incrementTransition === "function") {
    metrics.incrementTransition(beforeState, afterState);
  }
}

async function getTicketForUpdate(client, ticketId) {
  const result = await client.query("SELECT * FROM tickets WHERE id = $1 FOR UPDATE", [ticketId]);
  if (result.rowCount === 0) {
    throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }
  return result.rows[0];
}

function assertCommandStateAllowed(endpoint, fromState, body) {
  const policy = getCommandPolicy(endpoint);
  const allowedFromStates = policy.allowed_from_states;

  if (Array.isArray(allowedFromStates) && !allowedFromStates.includes(fromState)) {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "Transition is not allowed", {
      from_state: fromState,
      to_state: policy.expected_to_state,
    });
  }

  if (endpoint === "/tickets/{ticketId}/assignment/dispatch" && fromState === "TRIAGED") {
    const dispatchMode = typeof body.dispatch_mode === "string" ? body.dispatch_mode.trim() : null;
    if (dispatchMode !== "EMERGENCY_BYPASS") {
      throw new HttpError(
        409,
        "INVALID_STATE_TRANSITION",
        "TRIAGED -> DISPATCHED requires explicit emergency bypass reason",
        {
          from_state: fromState,
          to_state: policy.expected_to_state,
        },
      );
    }
  }
}

function validateTicketId(ticketId) {
  if (!isUuid(ticketId)) {
    throw new HttpError(400, "INVALID_TICKET_ID", "Path parameter 'ticketId' must be a valid UUID");
  }
}

async function assertTicketExists(pool, ticketId) {
  const ticketExists = await pool.query("SELECT 1 FROM tickets WHERE id = $1", [ticketId]);
  if (ticketExists.rowCount === 0) {
    throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }
}

async function getTicketTimeline(pool, ticketId) {
  validateTicketId(ticketId);
  await assertTicketExists(pool, ticketId);

  const result = await pool.query(
    `
      SELECT
        id,
        ticket_id,
        actor_type,
        actor_id,
        actor_role,
        tool_name,
        request_id,
        correlation_id,
        trace_id,
        before_state,
        after_state,
        payload,
        created_at
      FROM audit_events
      WHERE ticket_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [ticketId],
  );

  return {
    ticket_id: ticketId,
    events: result.rows.map(serializeAuditEvent),
  };
}

async function getTicketEvidence(pool, ticketId) {
  validateTicketId(ticketId);
  await assertTicketExists(pool, ticketId);

  const result = await pool.query(
    `
      SELECT
        id,
        ticket_id,
        kind,
        uri,
        checksum,
        metadata,
        created_by,
        created_at
      FROM evidence_items
      WHERE ticket_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [ticketId],
  );

  return {
    ticket_id: ticketId,
    evidence: result.rows.map(serializeEvidenceItem),
  };
}

function ensureString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "INVALID_REQUEST", `Field '${fieldName}' is required`);
  }
}

function ensureObjectField(value, fieldName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_REQUEST", `Field '${fieldName}' must be a JSON object`);
  }
}

function normalizeOptionalString(value, fieldName) {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `Field '${fieldName}' must be a non-empty string when provided`,
    );
  }
  return value.trim();
}

function readEvidenceKeyFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const evidenceKey = metadata.evidence_key;
  if (typeof evidenceKey !== "string" || evidenceKey.trim() === "") {
    return null;
  }
  return evidenceKey.trim();
}

function parseIsoDate(value, fieldName) {
  ensureString(value, fieldName);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "INVALID_REQUEST", `Field '${fieldName}' must be ISO date-time`);
  }
  return parsed.toISOString();
}

async function runWithIdempotency(params) {
  const {
    pool,
    actorId,
    endpoint,
    requestId,
    requestBody,
    runMutation,
  } = params;
  const requestHash = canonicalJsonHash(requestBody);
  const client = await pool.connect();

  try {
    const existing = await client.query(
      `
        SELECT request_hash, response_code, response_body
        FROM idempotency_keys
        WHERE actor_id = $1
          AND endpoint = $2
          AND request_id = $3
      `,
      [actorId, endpoint, requestId],
    );

    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.request_hash !== requestHash) {
        throw new HttpError(
          409,
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "Idempotency key reuse with different payload",
          { request_id: requestId },
        );
      }
      return {
        status: Number(row.response_code),
        body: row.response_body,
        replay: true,
      };
    }

    await client.query("BEGIN");
    try {
      const response = await runMutation(client);
      await client.query(
        `
          INSERT INTO idempotency_keys (
            actor_id,
            endpoint,
            request_id,
            request_hash,
            response_code,
            response_body
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [actorId, endpoint, requestId, requestHash, response.status, response.body],
      );
      await client.query("COMMIT");
      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        error &&
        error.code === "23505" &&
        typeof error.constraint === "string" &&
        error.constraint.includes("idempotency_keys")
      ) {
        const replay = await client.query(
          `
            SELECT request_hash, response_code, response_body
            FROM idempotency_keys
            WHERE actor_id = $1
              AND endpoint = $2
              AND request_id = $3
          `,
          [actorId, endpoint, requestId],
        );

        if (replay.rowCount > 0) {
          const row = replay.rows[0];
          if (row.request_hash !== requestHash) {
            throw new HttpError(
              409,
              "IDEMPOTENCY_PAYLOAD_MISMATCH",
              "Idempotency key reuse with different payload",
              { request_id: requestId },
            );
          }
          return {
            status: Number(row.response_code),
            body: row.response_body,
            replay: true,
          };
        }
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

async function createTicketMutation(client, context) {
  const { body, actor, requestId, correlationId, traceId, metrics } = context;
  ensureObject(body);
  requireUuidField(body.account_id, "account_id");
  requireUuidField(body.site_id, "site_id");
  if (body.asset_id != null) {
    requireUuidField(body.asset_id, "asset_id");
  }
  ensureString(body.summary, "summary");

  const insertResult = await client.query(
    `
      INSERT INTO tickets (
        account_id,
        site_id,
        asset_id,
        summary,
        description,
        nte_cents
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    [
      body.account_id,
      body.site_id,
      body.asset_id ?? null,
      body.summary.trim(),
      body.description ?? null,
      typeof body.nte_cents === "number" ? body.nte_cents : 0,
    ],
  );
  const ticket = insertResult.rows[0];

  await insertAuditAndTransition(client, {
    ticketId: ticket.id,
    beforeState: null,
    afterState: "NEW",
    metrics,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets",
      requested_at: nowIso(),
      request: body,
    },
  });

  return {
    status: 201,
    body: serializeTicket(ticket),
  };
}

async function triageTicketMutation(client, context) {
  const { ticketId, body, actor, requestId, correlationId, traceId, metrics } = context;
  ensureObject(body);
  ensureString(body.priority, "priority");
  ensureString(body.incident_type, "incident_type");

  const priority = body.priority.trim().toUpperCase();
  if (!["EMERGENCY", "URGENT", "ROUTINE"].includes(priority)) {
    throw new HttpError(400, "INVALID_REQUEST", "Field 'priority' is invalid");
  }
  if (body.nte_cents != null && (typeof body.nte_cents !== "number" || body.nte_cents < 0)) {
    throw new HttpError(400, "INVALID_REQUEST", "Field 'nte_cents' must be a non-negative number");
  }

  const existing = await getTicketForUpdate(client, ticketId);
  assertCommandStateAllowed("/tickets/{ticketId}/triage", existing.state, body);

  const update = await client.query(
    `
      UPDATE tickets
      SET
        state = 'TRIAGED',
        priority = $2,
        incident_type = $3,
        nte_cents = COALESCE($4, nte_cents),
        version = version + 1
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, priority, body.incident_type.trim(), body.nte_cents ?? null],
  );

  const ticket = update.rows[0];

  await insertAuditAndTransition(client, {
    ticketId,
    beforeState: existing.state,
    afterState: "TRIAGED",
    metrics,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets/{ticketId}/triage",
      requested_at: nowIso(),
      request: body,
    },
  });

  return {
    status: 200,
    body: serializeTicket(ticket),
  };
}

async function confirmScheduleMutation(client, context) {
  const { ticketId, body, actor, requestId, correlationId, traceId, metrics } = context;
  ensureObject(body);
  const start = parseIsoDate(body.start, "start");
  const end = parseIsoDate(body.end, "end");

  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new HttpError(400, "INVALID_REQUEST", "Field 'end' must be after 'start'");
  }

  const existing = await getTicketForUpdate(client, ticketId);
  assertCommandStateAllowed("/tickets/{ticketId}/schedule/confirm", existing.state, body);

  const update = await client.query(
    `
      UPDATE tickets
      SET
        state = 'SCHEDULED',
        scheduled_start = $2,
        scheduled_end = $3,
        version = version + 1
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, start, end],
  );
  const ticket = update.rows[0];

  await insertAuditAndTransition(client, {
    ticketId,
    beforeState: existing.state,
    afterState: "SCHEDULED",
    metrics,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets/{ticketId}/schedule/confirm",
      requested_at: nowIso(),
      request: body,
    },
  });

  return {
    status: 200,
    body: serializeTicket(ticket),
  };
}

async function dispatchAssignmentMutation(client, context) {
  const { ticketId, body, actor, requestId, correlationId, traceId, metrics } = context;
  ensureObject(body);
  requireUuidField(body.tech_id, "tech_id");
  if (body.provider_id != null) {
    requireUuidField(body.provider_id, "provider_id");
  }

  const existing = await getTicketForUpdate(client, ticketId);
  const dispatchMode = typeof body.dispatch_mode === "string" ? body.dispatch_mode.trim() : null;
  assertCommandStateAllowed("/tickets/{ticketId}/assignment/dispatch", existing.state, body);

  const update = await client.query(
    `
      UPDATE tickets
      SET
        state = 'DISPATCHED',
        assigned_tech_id = $2,
        assigned_provider_id = $3,
        version = version + 1
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, body.tech_id, body.provider_id ?? null],
  );
  const ticket = update.rows[0];

  await insertAuditAndTransition(client, {
    ticketId,
    beforeState: existing.state,
    afterState: "DISPATCHED",
    metrics,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets/{ticketId}/assignment/dispatch",
      requested_at: nowIso(),
      request: body,
      dispatch_mode: dispatchMode,
    },
  });

  return {
    status: 200,
    body: serializeTicket(ticket),
  };
}

async function addEvidenceMutation(client, context) {
  const { ticketId, body, actor, requestId, correlationId, traceId } = context;
  ensureObject(body);
  ensureString(body.kind, "kind");
  ensureString(body.uri, "uri");

  const checksum = normalizeOptionalString(body.checksum, "checksum");
  const evidenceKey = normalizeOptionalString(body.evidence_key, "evidence_key");

  if (body.metadata != null) {
    ensureObjectField(body.metadata, "metadata");
  }
  const metadata = body.metadata ? { ...body.metadata } : {};

  if (evidenceKey) {
    metadata.evidence_key = evidenceKey;
  }

  const existing = await getTicketForUpdate(client, ticketId);
  assertCommandStateAllowed("/tickets/{ticketId}/evidence", existing.state, body);

  const insert = await client.query(
    `
      INSERT INTO evidence_items (
        ticket_id,
        kind,
        uri,
        checksum,
        metadata,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    [ticketId, body.kind.trim(), body.uri.trim(), checksum, metadata, actor.actorId],
  );
  const evidenceItem = insert.rows[0];

  await insertAuditEvent(client, {
    ticketId,
    beforeState: existing.state,
    afterState: existing.state,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets/{ticketId}/evidence",
      requested_at: nowIso(),
      request: body,
      evidence_item_id: evidenceItem.id,
    },
  });

  return {
    status: 201,
    body: serializeEvidenceItem(evidenceItem),
  };
}

async function techCompleteMutation(client, context) {
  const { ticketId, body, actor, requestId, correlationId, traceId, metrics } = context;
  ensureObject(body);
  ensureObjectField(body.checklist_status, "checklist_status");

  const existing = await getTicketForUpdate(client, ticketId);
  assertCommandStateAllowed("/tickets/{ticketId}/tech/complete", existing.state, body);

  if (typeof existing.incident_type !== "string" || existing.incident_type.trim() === "") {
    throw new HttpError(409, "CLOSEOUT_REQUIREMENTS_INCOMPLETE", "Closeout requirements are incomplete", {
      requirement_code: "TEMPLATE_NOT_FOUND",
      incident_type: null,
      template_version: null,
      missing_evidence_keys: [],
      missing_checklist_keys: [],
    });
  }

  const evidenceResult = await client.query(
    `
      SELECT id, metadata
      FROM evidence_items
      WHERE ticket_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [ticketId],
  );

  const evidenceKeys = [];
  for (const row of evidenceResult.rows) {
    const evidenceKey = readEvidenceKeyFromMetadata(row.metadata);
    if (evidenceKey) {
      evidenceKeys.push(evidenceKey);
    }
  }

  let closeoutEvaluation;
  try {
    closeoutEvaluation = evaluateCloseoutRequirements({
      incident_type: existing.incident_type.trim(),
      evidence_items: evidenceKeys,
      checklist_status: body.checklist_status,
    });
  } catch (error) {
    if (error instanceof IncidentTemplatePolicyError) {
      throw new HttpError(409, "CLOSEOUT_REQUIREMENTS_INCOMPLETE", "Closeout requirements are incomplete", {
        requirement_code: "TEMPLATE_NOT_FOUND",
        incident_type: existing.incident_type.trim().toUpperCase(),
        template_version: null,
        missing_evidence_keys: [],
        missing_checklist_keys: [],
      });
    }
    throw error;
  }

  if (!closeoutEvaluation.ready) {
    throw new HttpError(409, "CLOSEOUT_REQUIREMENTS_INCOMPLETE", "Closeout requirements are incomplete", {
      requirement_code: closeoutEvaluation.code,
      incident_type: closeoutEvaluation.incident_type,
      template_version: closeoutEvaluation.template_version,
      missing_evidence_keys: closeoutEvaluation.missing_evidence_keys,
      missing_checklist_keys: closeoutEvaluation.missing_checklist_keys,
    });
  }

  const update = await client.query(
    `
      UPDATE tickets
      SET
        state = 'COMPLETED_PENDING_VERIFICATION',
        version = version + 1
      WHERE id = $1
      RETURNING *
    `,
    [ticketId],
  );
  const ticket = update.rows[0];

  await insertAuditAndTransition(client, {
    ticketId,
    beforeState: existing.state,
    afterState: "COMPLETED_PENDING_VERIFICATION",
    metrics,
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    toolName: actor.toolName,
    requestId,
    correlationId,
    traceId,
    payload: {
      endpoint: "/tickets/{ticketId}/tech/complete",
      requested_at: nowIso(),
      request: body,
      closeout_check: closeoutEvaluation,
      persisted_evidence_count: evidenceResult.rowCount,
    },
  });

  return {
    status: 200,
    body: serializeTicket(ticket),
  };
}

function resolveRoute(method, pathname) {
  if (method === "GET" && pathname === "/health") {
    return {
      kind: "health",
      endpoint: "/health",
    };
  }

  if (method === "GET" && pathname === "/metrics") {
    return {
      kind: "metrics",
      endpoint: "/metrics",
    };
  }

  const timelineMatch = pathname.match(/^\/tickets\/([^/]+)\/timeline$/);
  if (method === "GET" && timelineMatch) {
    return {
      kind: "timeline",
      endpoint: "/tickets/{ticketId}/timeline",
      ticketId: timelineMatch[1],
    };
  }

  const evidenceMatch = pathname.match(/^\/tickets\/([^/]+)\/evidence$/);
  if (method === "GET" && evidenceMatch) {
    return {
      kind: "evidence",
      endpoint: "/tickets/{ticketId}/evidence",
      ticketId: evidenceMatch[1],
    };
  }

  if (method === "POST" && pathname === "/tickets") {
    return {
      kind: "command",
      endpoint: "/tickets",
      handler: createTicketMutation,
      ticketId: null,
    };
  }

  const triageMatch = pathname.match(/^\/tickets\/([^/]+)\/triage$/);
  if (method === "POST" && triageMatch && ticketRouteRegex.test(triageMatch[1])) {
    return {
      kind: "command",
      endpoint: "/tickets/{ticketId}/triage",
      handler: triageTicketMutation,
      ticketId: triageMatch[1],
    };
  }

  const scheduleConfirmMatch = pathname.match(/^\/tickets\/([^/]+)\/schedule\/confirm$/);
  if (method === "POST" && scheduleConfirmMatch && ticketRouteRegex.test(scheduleConfirmMatch[1])) {
    return {
      kind: "command",
      endpoint: "/tickets/{ticketId}/schedule/confirm",
      handler: confirmScheduleMutation,
      ticketId: scheduleConfirmMatch[1],
    };
  }

  const dispatchMatch = pathname.match(/^\/tickets\/([^/]+)\/assignment\/dispatch$/);
  if (method === "POST" && dispatchMatch && ticketRouteRegex.test(dispatchMatch[1])) {
    return {
      kind: "command",
      endpoint: "/tickets/{ticketId}/assignment/dispatch",
      handler: dispatchAssignmentMutation,
      ticketId: dispatchMatch[1],
    };
  }

  if (method === "POST" && evidenceMatch && ticketRouteRegex.test(evidenceMatch[1])) {
    return {
      kind: "command",
      endpoint: "/tickets/{ticketId}/evidence",
      handler: addEvidenceMutation,
      ticketId: evidenceMatch[1],
    };
  }

  const techCompleteMatch = pathname.match(/^\/tickets\/([^/]+)\/tech\/complete$/);
  if (method === "POST" && techCompleteMatch && ticketRouteRegex.test(techCompleteMatch[1])) {
    return {
      kind: "command",
      endpoint: "/tickets/{ticketId}/tech/complete",
      handler: techCompleteMutation,
      ticketId: techCompleteMatch[1],
    };
  }

  return null;
}

export function createDispatchApiServer(options = {}) {
  const pool = options.pool ?? getPool();
  const host = options.host ?? process.env.DISPATCH_API_HOST ?? "127.0.0.1";
  const port = Number(options.port ?? process.env.DISPATCH_API_PORT ?? "8080");
  const logger = options.logger ?? console;
  const metrics = options.metrics ?? createMetricsRegistry();

  const server = createServer(async (request, response) => {
    const requestStart = Date.now();
    const requestMethod = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const route = resolveRoute(requestMethod, url.pathname);
    const correlationId = buildCorrelationId(request.headers);
    const traceId = buildTraceId(request.headers);

    if (!route) {
      sendJson(response, 404, {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          request_id: null,
        },
      });
      metrics.incrementRequest(requestMethod, "UNMATCHED", 404);
      metrics.incrementError("NOT_FOUND");
      emitStructuredLog(logger, "error", {
        method: requestMethod,
        path: url.pathname,
        endpoint: "UNMATCHED",
        request_id: null,
        correlation_id: correlationId,
        trace_id: traceId,
        actor_type: null,
        actor_id: null,
        actor_role: null,
        tool_name: null,
        ticket_id: null,
        replay: false,
        status: 404,
        error_code: "NOT_FOUND",
        message: "Route not found",
        duration_ms: Date.now() - requestStart,
      });
      return;
    }

    if (route.kind === "health") {
      sendJson(response, 200, {
        status: "ok",
        service: "dispatch-api",
        now: nowIso(),
      });
      metrics.incrementRequest(requestMethod, route.endpoint, 200);
      emitStructuredLog(logger, "info", {
        method: requestMethod,
        path: url.pathname,
        endpoint: route.endpoint,
        request_id: null,
        correlation_id: correlationId,
        trace_id: traceId,
        actor_type: null,
        actor_id: null,
        actor_role: null,
        tool_name: null,
        ticket_id: null,
        replay: false,
        status: 200,
        duration_ms: Date.now() - requestStart,
      });
      return;
    }

    if (route.kind === "metrics") {
      metrics.incrementRequest(requestMethod, route.endpoint, 200);
      const snapshot = metrics.snapshot();
      sendJson(response, 200, snapshot);
      emitStructuredLog(logger, "info", {
        method: requestMethod,
        path: url.pathname,
        endpoint: route.endpoint,
        request_id: null,
        correlation_id: correlationId,
        trace_id: traceId,
        actor_type: null,
        actor_id: null,
        actor_role: null,
        tool_name: null,
        ticket_id: null,
        replay: false,
        status: 200,
        duration_ms: Date.now() - requestStart,
      });
      return;
    }

    let requestId = null;
    let actor = null;
    try {
      if (route.kind === "timeline") {
        const timeline = await getTicketTimeline(pool, route.ticketId);
        sendJson(response, 200, timeline);
        metrics.incrementRequest(requestMethod, route.endpoint, 200);
        emitStructuredLog(logger, "info", {
          method: requestMethod,
          path: url.pathname,
          endpoint: route.endpoint,
          request_id: null,
          correlation_id: correlationId,
          trace_id: traceId,
          actor_type: null,
          actor_id: null,
          actor_role: null,
          tool_name: null,
          ticket_id: route.ticketId,
          replay: false,
          status: 200,
          duration_ms: Date.now() - requestStart,
        });
        return;
      }

      if (route.kind === "evidence") {
        const evidence = await getTicketEvidence(pool, route.ticketId);
        sendJson(response, 200, evidence);
        metrics.incrementRequest(requestMethod, route.endpoint, 200);
        emitStructuredLog(logger, "info", {
          method: requestMethod,
          path: url.pathname,
          endpoint: route.endpoint,
          request_id: null,
          correlation_id: correlationId,
          trace_id: traceId,
          actor_type: null,
          actor_id: null,
          actor_role: null,
          tool_name: null,
          ticket_id: route.ticketId,
          replay: false,
          status: 200,
          duration_ms: Date.now() - requestStart,
        });
        return;
      }

      if (route.kind !== "command") {
        throw new HttpError(500, "INTERNAL_ERROR", "Unsupported route handler");
      }

      const body = await parseJsonBody(request);
      requestId = parseIdempotencyKey(request.headers);
      actor = parseActorFromHeaders(request.headers, route.endpoint);

      const result = await runWithIdempotency({
        pool,
        actorId: actor.actorId,
        endpoint: route.endpoint,
        requestId,
        requestBody: body,
        runMutation: async (client) =>
          route.handler(client, {
            body,
            ticketId: route.ticketId,
            actor,
            requestId,
            correlationId,
            traceId,
            metrics,
          }),
      });

      sendJson(response, result.status, result.body);
      metrics.incrementRequest(requestMethod, route.endpoint, result.status);
      if (result.replay) {
        metrics.incrementIdempotencyReplay();
      }
      emitStructuredLog(logger, "info", {
        method: requestMethod,
        path: url.pathname,
        endpoint: route.endpoint,
        request_id: requestId,
        correlation_id: correlationId,
        trace_id: traceId,
        actor_type: actor.actorType,
        actor_id: actor.actorId,
        actor_role: actor.actorRole,
        tool_name: actor.toolName,
        ticket_id: route.ticketId ?? null,
        replay: result.replay ?? false,
        status: result.status,
        duration_ms: Date.now() - requestStart,
      });
    } catch (error) {
      const known = error instanceof HttpError;
      const status = known ? error.status : 500;
      const body = errorBody(
        known
          ? error
          : new HttpError(500, "INTERNAL_ERROR", "Internal server error", {
              reference: randomUUID(),
            }),
        requestId,
      );
      sendJson(response, status, body);
      const endpoint = route?.endpoint ?? "UNMATCHED";
      metrics.incrementRequest(requestMethod, endpoint, status);
      metrics.incrementError(body.error.code);
      if (body.error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
        metrics.incrementIdempotencyConflict();
      }

      emitStructuredLog(logger, "error", {
        method: requestMethod,
        path: url.pathname,
        endpoint,
        request_id: requestId,
        correlation_id: correlationId,
        trace_id: traceId,
        actor_type: actor?.actorType ?? null,
        actor_id: actor?.actorId ?? null,
        actor_role: actor?.actorRole ?? null,
        tool_name: actor?.toolName ?? null,
        ticket_id: route?.ticketId ?? null,
        replay: false,
        status,
        error_code: body.error.code,
        message: body.error.message,
        duration_ms: Date.now() - requestStart,
      });
    }
  });

  return {
    host,
    port,
    server,
    getMetricsSnapshot() {
      return metrics.snapshot();
    },
    start() {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          resolve({ host, port });
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export async function startDispatchApi(options = {}) {
  const app = createDispatchApiServer(options);
  await app.start();
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createDispatchApiServer();
  app
    .start()
    .then(({ host, port }) => {
      console.log(
        JSON.stringify({
          level: "info",
          service: "dispatch-api",
          message: "dispatch-api started",
          host,
          port,
        }),
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          service: "dispatch-api",
          message: "dispatch-api failed to start",
          error: error?.message ?? String(error),
        }),
      );
      process.exitCode = 1;
    });

  const shutdown = async () => {
    await app.stop();
    await closePool();
  };

  process.on("SIGINT", () => {
    shutdown().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    shutdown().finally(() => process.exit(0));
  });
}
