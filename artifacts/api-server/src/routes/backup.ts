import { Router } from "express";
import { runBackup, listBackups } from "../lib/backup.js";

const router = Router();

// POST /api/backup — trigger a manual backup
router.post("/backup", (req, res) => {
  try {
    const result = runBackup();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backups — list all backups
router.get("/backups", (_req, res) => {
  try {
    const backups = listBackups();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
