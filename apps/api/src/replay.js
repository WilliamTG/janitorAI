// Durable replay discovery, cloning and worker primitives.
// This module deliberately has no HTTP dependencies so it can be unit tested
// with a small fake pool and reused by the admin routes and startup worker.

const { randomUUID, createHmac } = require("crypto");
const { signedMediaUrl } = require("./mediaSign");

const TERMINAL_BATCH_STATES = new Set(["completed", "failed", "cancelled"]);
const TERMINAL_ITEM_STATES = new Set(["succeeded", "failed", "skipped", "cancelled"]);
const LOCAL_URI = /^(?:file|content|ph|blob|data|idb):/i;
const GOOGLE_DOC_URL =
  /^https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]+(?:\/(?:edit|view))?(?:\?[A-Za-z0-9=&_.-]+)?$/;

function strictGoogleDocUrl(value) {
  return typeof value === "string" && GOOGLE_DOC_URL.test(value.trim());
}

function previewSecret() {
  return process.env.ADMIN_SECRET || process.env.SESSION_SECRET || "";
}

function scopeDigest(rows, secret = previewSecret()) {
  const scope = rows
    .map((row) => [
      String(row.tester_token || ""),
      String(row.source_project_id || ""),
      String(row.report_doc_id || ""),
    ].join("\u0000"))
    .sort()
    .join("\n");
  return createHmac("sha256", secret).update(scope).digest("hex");
}

function reason(message) {
  const error = new Error(message);
  error.code = "REPLAY_UNREPRESENTABLE_EVIDENCE";
  return error;
}

function isLocalUri(value) {
  return typeof value === "string" &&
    (LOCAL_URI.test(value.trim()) || value.startsWith("/") || value.startsWith("~"));
}

function clearReportFields(project) {
  const result = { ...project };
  for (const key of [
    "report", "reportUrl", "reportStatus", "reportError", "reportApproval",
    "reportDraft", "reportFinal", "reportAttemptId",
  ]) delete result[key];
  return result;
}

/**
 * Clone persisted project JSON after ownership has been checked.  The media
 * set is intentionally supplied by the caller (rather than querying here),
 * making accidental cross-tenant media references impossible.
 */
function cloneProjectData(source, { copyProjectId, batchId, ownedMediaIds, sourceProjectId }) {
  const owned = new Set([...ownedMediaIds].map(String));
  const copied = clearReportFields(JSON.parse(JSON.stringify(source || {})));
  const errors = [];

  function visit(value, key, parent) {
    if (Array.isArray(value)) return value.map((entry) => visit(entry, key, parent));
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && isLocalUri(value) &&
          /(?:uri|url|audio|video|photo|description|media)/i.test(key || "")) {
        errors.push(`local-only evidence in ${key}`);
      }
      return value;
    }
    const output = {};
    const hasDurableMediaId = Object.entries(value).some(([entryKey, entryValue]) =>
      (entryKey.toLowerCase() === "remoteid" || entryKey.toLowerCase().endsWith("remoteid")) &&
      entryValue != null && String(entryValue).trim()
    );
    for (const [childKey, childValue] of Object.entries(value)) {
      const lower = childKey.toLowerCase();
      if (["report", "reporturl", "reportstatus", "reporterror", "reportapproval",
        "reportdraft", "reportfinal", "reportattemptid"].includes(lower)) continue;

      if (lower === "remoteid" || lower.endsWith("remoteid")) {
        if (childValue != null && String(childValue).trim()) {
          const id = String(childValue);
          if (!owned.has(id)) errors.push(`media ${id} is not owned by tester`);
          else output[childKey] = id;
        }
        continue;
      }
      if (lower === "uri" || lower.endsWith("uri") || lower === "url") {
        // Remote media IDs are the durable representation.  URLs are never
        // copied, except ordinary non-evidence metadata URLs.
        if (hasDurableMediaId &&
            (lower === "uri" || lower.endsWith("uri") ||
             /(?:audio|video|photo|description|media)/i.test(lower))) {
          continue;
        }
        if (typeof childValue === "string" && childValue.trim()) {
          if (
            lower === "uri" ||
            lower.endsWith("uri") ||
            isLocalUri(childValue) ||
            /(?:audio|video|photo|description|media)/i.test(lower)
          ) {
            errors.push(`non-durable evidence URI in ${childKey}`);
            continue;
          }
        }
        if (lower === "reporturl") continue;
      }
      output[childKey] = visit(childValue, childKey, value);
    }
    return output;
  }

  const result = visit(copied, "", null);
  if (errors.length) throw reason(errors[0]);
  result.id = copyProjectId;
  result.isTestProject = true;
  result.sourceProjectId = String(sourceProjectId || source.id || "");
  result.replayBatchId = String(batchId);
  // A copy should not inherit the source's local-first sync timestamp.
  result.updatedAt = new Date().toISOString();
  return result;
}

function maskedTesterLabel(row) {
  if (row.tester_name) return row.tester_name;
  return "Unnamed tester";
}

function collectRemoteIds(value, result = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRemoteIds(entry, result));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (
        (key.toLowerCase() === "remoteid" || key.toLowerCase().endsWith("remoteid")) &&
        child != null &&
        String(child).trim()
      ) {
        result.add(String(child));
      }
      collectRemoteIds(child, result);
    }
  }
  return result;
}

function projectEvidenceSummary(data) {
  const project = data && typeof data === "object" ? data : {};
  const notes = Array.isArray(project.notes) ? project.notes : [];
  const photoIds = collectRemoteIds(
    notes.map((note) => note && note.photos).filter(Boolean)
  );
  const videoIds = collectRemoteIds({
    videoRemoteId: project.videoRemoteId,
    videoUri: project.videoUri,
    video: project.video,
  });
  const transcriptionCount = notes.filter(
    (note) => note && typeof note.transcription === "string" && note.transcription.trim()
  ).length;
  return {
    noteCount: notes.length,
    photoCount: photoIds.size,
    videoCount: videoIds.size,
    transcriptionCount,
  };
}

async function discoverEligible(pool) {
  const result = await pool.query(`
    SELECT DISTINCT ON (p.tester_token, p.id)
      p.id AS source_project_id, p.tester_token, p.data,
      COALESCE(rg.doc_id, p.data->>'reportUrl') AS report_doc_id,
      t.tester_name
    FROM projects p
    LEFT JOIN report_generations rg
      ON rg.tester_token = p.tester_token
     AND rg.project_id = p.id
     AND rg.status = 'success'
     AND rg.doc_id IS NOT NULL
    LEFT JOIN tester_tokens t ON t.token = p.tester_token
    WHERE p.tester_token IS NOT NULL
      AND COALESCE(p.data->>'isTestProject', 'false') <> 'true'
      AND (
        rg.doc_id IS NOT NULL
        OR (p.data->>'reportUrl') ~
          '^https://docs[.]google[.]com/document/d/[A-Za-z0-9_-]+(/(edit|view))?([?][A-Za-z0-9=&_.-]+)?$'
      )
    ORDER BY p.tester_token, p.id, rg.created_at DESC NULLS LAST
  `);
  return result.rows;
}

async function preview(pool) {
  const rows = await discoverEligible(pool);
  const eligibleProjects = rows.map((row) => ({
    projectId: row.source_project_id,
    sourceProjectId: row.source_project_id,
    tester: maskedTesterLabel(row),
    projectName: row.data && row.data.name ? String(row.data.name) : row.source_project_id,
    inspectionDate: row.data && row.data.inspectionDate
      ? String(row.data.inspectionDate)
      : null,
    inspector: row.data && row.data.inspector ? String(row.data.inspector) : null,
    updatedAt: row.data && row.data.updatedAt ? String(row.data.updatedAt) : null,
    evidence: projectEvidenceSummary(row.data),
    reportDocument: row.report_doc_id,
  }));
  const testerAccountCount = new Set(rows.map((row) => String(row.tester_token))).size;
  const previewId = scopeDigest(rows);
  return {
    count: rows.length,
    projects: eligibleProjects,
    eligibleProjects,
    testerAccounts: testerAccountCount,
    testerAccountCount,
    previewId,
    skipped: [],
  };
}

function normalizeSelectedProjectIds(selectedProjectIds) {
  if (selectedProjectIds == null) return null;
  if (!Array.isArray(selectedProjectIds) || selectedProjectIds.length === 0) {
    const error = new Error("At least one replay project must be selected");
    error.code = "REPLAY_SELECTION_INVALID";
    throw error;
  }
  const ids = [...new Set(
    selectedProjectIds
      .filter((id) => typeof id === "string" || typeof id === "number")
      .map((id) => String(id).trim())
      .filter(Boolean)
  )];
  if (!ids.length) {
    const error = new Error("At least one replay project must be selected");
    error.code = "REPLAY_SELECTION_INVALID";
    throw error;
  }
  return ids;
}

async function createBatch(pool, expectedPreviewId, selectedProjectIds = null) {
  const selectedIds = normalizeSelectedProjectIds(selectedProjectIds);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize the "find active or create" decision. Row locks alone cannot
    // protect the empty-set case when two admins start at the same time.
    await client.query("SELECT pg_advisory_xact_lock($1)", [762024]);
    const scopeRows = await client.query(`
      SELECT DISTINCT ON (p.tester_token, p.id)
        p.id AS source_project_id, p.tester_token, p.data,
        COALESCE(rg.doc_id, p.data->>'reportUrl') AS report_doc_id
      FROM projects p
      LEFT JOIN report_generations rg
        ON rg.tester_token = p.tester_token AND rg.project_id = p.id
       AND rg.status = 'success' AND rg.doc_id IS NOT NULL
      WHERE p.tester_token IS NOT NULL
        AND COALESCE(p.data->>'isTestProject', 'false') <> 'true'
        AND (
          rg.doc_id IS NOT NULL OR (p.data->>'reportUrl') ~
          '^https://docs[.]google[.]com/document/d/[A-Za-z0-9_-]+(/(edit|view))?([?][A-Za-z0-9=&_.-]+)?$'
        )
      ORDER BY p.tester_token, p.id, rg.created_at DESC NULLS LAST
    `);
    if (scopeDigest(scopeRows.rows) !== expectedPreviewId) {
      const stale = new Error("Replay preview is stale; refresh preview and confirm again");
      stale.code = "REPLAY_PREVIEW_STALE";
      throw stale;
    }
    const eligibleById = new Map(
      scopeRows.rows.map((row) => [String(row.source_project_id), row])
    );
    const rowsToReplay = selectedIds
      ? selectedIds.map((id) => eligibleById.get(id)).filter(Boolean)
      : scopeRows.rows;
    if (selectedIds && rowsToReplay.length !== selectedIds.length) {
      const invalid = selectedIds.find((id) => !eligibleById.has(id));
      const error = new Error(
        `Replay selection is stale or contains an ineligible project${invalid ? `: ${invalid}` : ""}`
      );
      error.code = "REPLAY_SELECTION_STALE";
      throw error;
    }
    const active = await client.query(
      `SELECT id, status FROM replay_batches
       WHERE status IN ('queued','running') ORDER BY id DESC LIMIT 1 FOR UPDATE`
    );
    if (active.rows.length) {
      await client.query("COMMIT");
      return { id: active.rows[0].id, existing: true };
    }
    const batch = await client.query(
      `INSERT INTO replay_batches (status) VALUES ('queued') RETURNING id, status, requested_at`
    );
    const rows = { rows: rowsToReplay };
    for (const row of rows.rows) {
      const copyId = randomUUID();
      const attemptId = randomUUID();
      await client.query(
        `INSERT INTO replay_batch_items
          (batch_id, tester_token, source_project_id, copy_project_id, report_attempt_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (batch_id, tester_token, source_project_id) DO NOTHING`,
        [batch.rows[0].id, row.tester_token, row.source_project_id, copyId, attemptId]
      );
    }
    if (rows.rows.length === 0) {
      await client.query(
        "UPDATE replay_batches SET status='completed', started_at=now(), finished_at=now(), updated_at=now() WHERE id=$1",
        [batch.rows[0].id]
      );
    }
    await client.query("COMMIT");
    return { ...batch.rows[0], existing: false, itemCount: rows.rows.length };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function getReplayProject(pool, projectId, { mediaBaseUrl } = {}) {
  const projectResult = await pool.query(
    `SELECT p.id, p.data, p.updated_at, t.tester_name
       FROM projects p
       LEFT JOIN tester_tokens t ON t.token = p.tester_token
      WHERE p.id = $1
      LIMIT 1`,
    [String(projectId)]
  );
  if (!projectResult.rows.length) return null;

  const row = projectResult.rows[0];
  const replayResult = await pool.query(
    `SELECT i.batch_id, i.source_project_id, i.copy_project_id, i.state,
            i.progress, i.error, i.started_at, i.finished_at,
            b.status AS batch_status,
            sp.data AS source_data,
            cp.data AS copy_data
       FROM replay_batch_items i
       JOIN replay_batches b ON b.id = i.batch_id
       LEFT JOIN projects sp
         ON sp.id = i.source_project_id AND sp.tester_token = i.tester_token
       LEFT JOIN projects cp
         ON cp.id = i.copy_project_id AND cp.tester_token = i.tester_token
      WHERE i.source_project_id = $1 OR i.copy_project_id = $1
      ORDER BY i.id DESC`,
    [String(projectId)]
  );

  const remoteIds = [...collectRemoteIds(row.data)];
  const mediaResult = remoteIds.length
    ? await pool.query(
        `SELECT id, kind, mime_type, original_name, size_bytes, created_at
           FROM media
          WHERE tester_token = $1 AND id = ANY($2)`,
        [replayResult.rows[0]?.tester_token || null, remoteIds]
      )
    : { rows: [] };
  // The project lookup intentionally does not return tester_token. Use a
  // tenant value from a second, narrow query only for media authorization.
  // This value is never included in the response.
  if (remoteIds.length && !replayResult.rows[0]?.tester_token) {
    const owner = await pool.query(
      "SELECT tester_token FROM projects WHERE id=$1 LIMIT 1",
      [String(projectId)]
    );
    if (owner.rows.length) {
      const authorizedMedia = await pool.query(
        `SELECT id, kind, mime_type, original_name, size_bytes, created_at
           FROM media
          WHERE tester_token = $1 AND id = ANY($2)`,
        [owner.rows[0].tester_token, remoteIds]
      );
      mediaResult.rows = authorizedMedia.rows;
    }
  }

  const mediaById = new Map(mediaResult.rows.map((media) => [String(media.id), media]));
  const base = typeof mediaBaseUrl === "string" ? mediaBaseUrl.replace(/\/$/, "") : "";
  const media = mediaResult.rows.map((entry) => ({
    id: String(entry.id),
    kind: entry.kind || null,
    mimeType: entry.mime_type || null,
    originalName: entry.original_name || null,
    sizeBytes: entry.size_bytes == null ? null : Number(entry.size_bytes),
    createdAt: entry.created_at || null,
    url: base ? signedMediaUrl(base, entry.id, 10 * 60 * 1000) : null,
  }));

  const replayItems = replayResult.rows.map((item) => ({
    batchId: item.batch_id,
    sourceProjectId: item.source_project_id,
    copyProjectId: item.copy_project_id,
    state: item.state,
    progress: item.progress,
    error: item.error,
    startedAt: item.started_at,
    finishedAt: item.finished_at,
    batchStatus: item.batch_status,
    sourceProjectName: item.source_data?.name || null,
    copyProjectName: item.copy_data?.name || null,
  }));
  const relation = replayItems[0] || null;
  const role = relation
    ? String(projectId) === String(relation.copyProjectId) ? "replay-copy" : "source"
    : "source";
  const missingMediaIds = remoteIds.filter((id) => !mediaById.has(String(id)));

  return {
    projectId: String(row.id),
    tester: maskedTesterLabel(row),
    role,
    project: row.data || {},
    updatedAt: row.updated_at || null,
    evidence: projectEvidenceSummary(row.data),
    media,
    missingMediaIds,
    replay: relation,
    replayHistory: replayItems,
  };
}

async function getBatch(pool, id) {
  const batch = await pool.query("SELECT * FROM replay_batches WHERE id = $1", [id]);
  if (!batch.rows.length) return null;
  const items = await pool.query(
    `SELECT i.id, i.source_project_id, i.copy_project_id, i.state, i.progress,
            i.error, i.started_at, i.finished_at, t.tester_name
       FROM replay_batch_items i LEFT JOIN tester_tokens t ON t.token=i.tester_token
      WHERE i.batch_id=$1 ORDER BY i.id`,
    [id]
  );
  const mappedItems = items.rows.map((item) => ({
    ...item, tester: maskedTesterLabel(item), tester_token: undefined,
  }));
  const summary = mappedItems.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, {});
  return {
    ...batch.rows[0],
    total: mappedItems.length,
    summary,
    counts: {
      created: mappedItems.filter((item) => Number(item.progress) >= 25).length,
      generated: summary.succeeded || 0,
      skipped: summary.skipped || 0,
      failed: summary.failed || 0,
      pending: (summary.pending || 0) + (summary.running || 0),
    },
    items: mappedItems.map((item) => ({
      ...item,
      status: item.state === "succeeded" ? "generated" : item.state,
    })),
  };
}

module.exports = {
  TERMINAL_BATCH_STATES,
  TERMINAL_ITEM_STATES,
  strictGoogleDocUrl,
  scopeDigest,
  projectEvidenceSummary,
  normalizeSelectedProjectIds,
  cloneProjectData,
  discoverEligible,
  preview,
  createBatch,
  getReplayProject,
  getBatch,
};