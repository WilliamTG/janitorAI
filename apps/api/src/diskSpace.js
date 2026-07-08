// diskSpace.js – free-space monitoring for the media disk (MEDIA_DIR).
//
// The Render persistent disk is small (1 GB by default), so it can fill up
// from legitimate usage. Two thresholds:
//   - WARN  (default 80% used): log a prominent warning so it shows up in
//     Render logs well before uploads start failing.
//   - CRITICAL (default 95% used): also refuse new uploads with a clear,
//     user-explainable 507 error instead of letting writes fail with a
//     generic 500 (or silently corrupt half-written files).
//
// Thresholds are configurable via MEDIA_DISK_WARN_PERCENT and
// MEDIA_DISK_CRITICAL_PERCENT. fs.statfs reports the whole filesystem that
// MEDIA_DIR lives on, which is exactly the mounted disk on Render.

const fs = require("fs");

function readPercentEnv(name, fallback) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0 || value > 100) return fallback;
  return value;
}

const WARN_PERCENT = readPercentEnv("MEDIA_DISK_WARN_PERCENT", 80);
const CRITICAL_PERCENT = Math.max(
  WARN_PERCENT,
  readPercentEnv("MEDIA_DISK_CRITICAL_PERCENT", 95)
);

let statfsUnsupportedLogged = false;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "unknown";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

/**
 * Disk usage for the filesystem containing `dir`.
 * Returns null when statfs is unavailable (old Node) or the check fails —
 * callers must treat null as "unknown" and not block anything on it.
 */
async function getDiskUsage(dir) {
  if (typeof fs.promises.statfs !== "function") {
    if (!statfsUnsupportedLogged) {
      statfsUnsupportedLogged = true;
      console.warn(
        "Media disk check: fs.statfs not available on this Node version; free-space monitoring disabled"
      );
    }
    return null;
  }

  try {
    const stats = await fs.promises.statfs(dir);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    return { totalBytes, freeBytes, usedBytes, usedPercent };
  } catch (err) {
    console.warn(
      `Media disk check failed for ${dir}: ${err && err.message ? err.message : err}`
    );
    return null;
  }
}

/**
 * Check usage and log a warning when a threshold is crossed. Returns the
 * usage object (or null if unknown) so callers can reuse it.
 */
async function checkAndLogDiskUsage(dir) {
  const usage = await getDiskUsage(dir);
  if (!usage) return null;

  const summary = `${usage.usedPercent.toFixed(1)}% used, ${formatBytes(
    usage.freeBytes
  )} free of ${formatBytes(usage.totalBytes)}`;

  if (usage.usedPercent >= CRITICAL_PERCENT) {
    console.error(
      `*** MEDIA DISK CRITICAL: ${summary} (>= ${CRITICAL_PERCENT}%). New uploads are being rejected until space is freed — grow the disk or remove old projects. ***`
    );
  } else if (usage.usedPercent >= WARN_PERCENT) {
    console.warn(
      `*** MEDIA DISK WARNING: ${summary} (>= ${WARN_PERCENT}%). Uploads will be rejected at ${CRITICAL_PERCENT}% — consider growing the disk. ***`
    );
  }

  return usage;
}

/**
 * True when the disk is so full that new uploads should be refused.
 * Unknown usage (null) never blocks uploads.
 */
function isCritical(usage) {
  return !!usage && usage.usedPercent >= CRITICAL_PERCENT;
}

module.exports = {
  WARN_PERCENT,
  CRITICAL_PERCENT,
  formatBytes,
  getDiskUsage,
  checkAndLogDiskUsage,
  isCritical,
};
