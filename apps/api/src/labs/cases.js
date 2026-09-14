const fs = require("fs");
const path = require("path");

const FIXTURE_PATH = path.join(__dirname, "../../fixtures/benchmark-cases.json");

/**
 * Reads the committed fasit fixture. Ground truth lives in git, not in the
 * database, so a change to it shows up in a diff — a silently edited fasit
 * would invalidate every score recorded before the edit.
 */
function readFixture(fixturePath = FIXTURE_PATH) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
  for (const entry of cases) {
    if (!entry.case_id) throw new Error("benchmark fixture: a case is missing case_id");
    if (!entry.reference) throw new Error(`benchmark fixture: ${entry.case_id} is missing reference`);
  }
  return cases;
}

/**
 * Upserts the fixture into benchmark_cases. The table is a read cache for the
 * dashboard; the fixture stays authoritative, so every boot overwrites it.
 */
async function loadBenchmarkCases(pool, fixturePath = FIXTURE_PATH) {
  const cases = readFixture(fixturePath);
  for (const entry of cases) {
    await pool.query(
      `INSERT INTO benchmark_cases (case_id, label, project_id, provisional, reference, source_note, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
       ON CONFLICT (case_id) DO UPDATE SET
         label = EXCLUDED.label,
         project_id = EXCLUDED.project_id,
         provisional = EXCLUDED.provisional,
         reference = EXCLUDED.reference,
         source_note = EXCLUDED.source_note,
         updated_at = now()`,
      [
        entry.case_id,
        entry.label || entry.case_id,
        entry.project_id || null,
        entry.provisional !== false,
        JSON.stringify(entry.reference),
        entry.source_note || null,
      ]
    );
  }
  return cases.length;
}

async function listBenchmarkCases(pool) {
  const result = await pool.query(
    `SELECT case_id, label, project_id, provisional, reference, source_note, updated_at
       FROM benchmark_cases ORDER BY case_id`
  );
  return result.rows;
}

async function getBenchmarkCase(pool, caseId) {
  const result = await pool.query(
    `SELECT case_id, label, project_id, provisional, reference, source_note, updated_at
       FROM benchmark_cases WHERE case_id = $1`,
    [String(caseId)]
  );
  return result.rows[0] || null;
}

module.exports = {
  FIXTURE_PATH,
  readFixture,
  loadBenchmarkCases,
  listBenchmarkCases,
  getBenchmarkCase,
};
