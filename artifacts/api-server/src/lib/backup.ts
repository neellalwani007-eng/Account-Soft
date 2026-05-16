import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

const DB_DIR = process.env.DB_PATH || path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "accountsoft.db");
const BACKUP_DIR = path.join(DB_DIR, "backups");
const MAX_BACKUPS = 30;

export function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function runBackup(): { file: string; size: number } {
  ensureBackupDir();

  if (!fs.existsSync(DB_FILE)) {
    throw new Error("Database file not found — nothing to backup.");
  }

  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const dest = path.join(BACKUP_DIR, `accountsoft_${ts}.db`);

  fs.copyFileSync(DB_FILE, dest);
  const { size } = fs.statSync(dest);
  logger.info({ dest, size }, "Backup created");

  pruneOldBackups();

  return { file: path.basename(dest), size };
}

function pruneOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("accountsoft_") && f.endsWith(".db"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  for (const old of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    logger.info({ file: old.name }, "Old backup pruned");
  }
}

export function listBackups(): { file: string; size: number; created: string }[] {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("accountsoft_") && f.endsWith(".db"))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { file: f, size: stat.size, created: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let schedulerHandle: NodeJS.Timeout | null = null;

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 5 seconds past midnight to avoid edge cases
  return midnight.getTime() - now.getTime();
}

export function startAutoBackup() {
  const triggerDaily = () => {
    try {
      runBackup();
      logger.info("Scheduled midnight backup completed");
    } catch (err) {
      logger.error({ err }, "Scheduled backup failed");
    }
    // Re-schedule for next midnight
    schedulerHandle = setTimeout(triggerDaily, msUntilMidnight());
  };

  // First trigger at next midnight
  schedulerHandle = setTimeout(triggerDaily, msUntilMidnight());
  logger.info(
    { nextBackupIn: `${Math.round(msUntilMidnight() / 60000)} min` },
    "Auto-backup scheduler started"
  );
}

export function stopAutoBackup() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
