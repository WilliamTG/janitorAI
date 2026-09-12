const test = require("node:test");
const assert = require("node:assert/strict");
const {
  strictGoogleDocUrl,
  cloneProjectData,
} = require("../src/replay");
const { processItem } = require("../src/replayWorker");
const { canResumeExistingAttempt } = require("../src/reportService");
const { createBatch, scopeDigest } = require("../src/replay");
const fs = require("node:fs");

test("only replay workers may resume a processing ledger attempt", () => {
  assert.equal(canResumeExistingAttempt(true, "processing"), true);
  assert.equal(canResumeExistingAttempt(false, "processing"), false);
  assert.equal(canResumeExistingAttempt(true, "success"), false);
});

test("admin dashboard treats queued replay batches as active and pollable", () => {
  const html = fs.readFileSync(
    require.resolve("../src/admin-dashboard.html"), "utf8"
  );
  assert.match(html, /active = \['queued','pending','running','active','processing','in_progress'\]/);
  assert.match(html, /!?\['queued','pending','running','active','processing','in_progress'\]\.includes\(replayStatus\(batch\)\)/);
});

test("batch creation locks the transaction before active-batch discovery", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === "SELECT pg_advisory_xact_lock($1)") return { rows: [] };
      if (sql.includes("FROM replay_batches")) return { rows: [] };
      if (sql.includes("INSERT INTO replay_batches")) {
        return { rows: [{ id: 9, status: "queued", requested_at: new Date() }] };
      }
      if (sql.includes("FROM projects p")) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  await createBatch({ connect: async () => client }, scopeDigest([]));
  assert.equal(calls[0], "BEGIN");
  assert.equal(calls[1], "SELECT pg_advisory_xact_lock($1)");
  assert.match(calls[2], /FROM replay_batches|FROM projects p/);
});

test("strict Google Docs legacy URL validation", () => {
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc_123/edit"), true);
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc_123"), true);
  assert.equal(strictGoogleDocUrl("http://docs.google.com/document/d/abc/edit"), false);
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc/export?format=pdf"), false);
  assert.equal(strictGoogleDocUrl("https://evil.example/document/d/abc/edit"), false);
});

test("clone strips local evidence, keeps owned media, clears report state, and does not mutate source", () => {
  const source = {
    id: "source-1",
    name: "Source",
    reportUrl: "https://docs.google.com/document/d/old/edit",
    reportStatus: "ready",
    reportDraft: { content: { old: true } },
    reportFinal: { content: { old: true } },
    reportApproval: { approvedBy: "someone" },
    notes: [{ photos: [{ uri: "file:///private/photo.jpg", remoteId: "media-1", caption: "durable" }] }],
  };
  const before = JSON.stringify(source);
  const copy = cloneProjectData(source, {
    copyProjectId: "copy-1",
    sourceProjectId: "source-1",
    batchId: 7,
    ownedMediaIds: ["media-1"],
  });
  assert.equal(JSON.stringify(source), before);
  assert.equal(copy.id, "copy-1");
  assert.equal(copy.sourceProjectId, "source-1");
  assert.equal(copy.replayBatchId, "7");
  assert.equal(copy.isTestProject, true);
  assert.equal(copy.reportUrl, undefined);
  assert.equal(copy.reportStatus, undefined);
  assert.equal(copy.notes[0].photos[0].remoteId, "media-1");
  assert.equal(copy.notes[0].photos[0].uri, undefined);
});

test("clone rejects missing and cross-tenant media instead of dropping evidence", () => {
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "file:///x", remoteId: "missing" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "file:///x" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "idb://photo-1" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "https://temporary.example/photo.jpg" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
});

function fakePool(source, mediaIds = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT data FROM projects")) return { rows: [{ data: source }] };
      if (sql.startsWith("SELECT id FROM media")) return { rows: mediaIds.map((id) => ({ id })) };
      if (sql.startsWith("SELECT status FROM replay_batches")) return { rows: [{ status: "running" }] };
      return { rows: [], rowCount: 1 };
    },
  };
}

test("worker isolates a failed item and records a durable failure", async () => {
  const pool = fakePool({ id: "source", notes: [] });
  const item = {
    id: 1, batch_id: 4, source_project_id: "source", copy_project_id: "copy",
    report_attempt_id: "attempt", tester_token: "tenant-a",
  };
  await processItem(pool, item, async () => { throw new Error("engine unavailable"); });
  const finish = pool.calls.find((call) => call.sql.includes("SET state=$2"));
  assert.ok(finish);
  assert.equal(finish.params[1], "failed");
  assert.match(finish.params[3], /engine unavailable/);
});