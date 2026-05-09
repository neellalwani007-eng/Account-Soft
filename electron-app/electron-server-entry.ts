/**
 * Electron server entry — bundled by esbuild into src/server-bundle.cjs
 *
 * This wraps the existing Express app and adds:
 *   • Static file serving for the built React frontend
 *   • SPA fallback so client-side routing works
 *   • Auto-backup startup
 *
 * It exports `startServer(port, staticDir)` so the Electron main process
 * can start it inline (same Node.js process, no child process needed).
 */

import app from "../artifacts/api-server/src/app.js";
import express from "express";
import path from "path";
import fs from "fs";
import { startAutoBackup } from "../artifacts/api-server/src/lib/backup.js";

export function startServer(port: number, staticDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (staticDir && fs.existsSync(staticDir)) {
      app.use(express.static(staticDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(staticDir, "index.html"));
      });
    }

    app.listen(port, "127.0.0.1", (err?: Error) => {
      if (err) return reject(err);
      startAutoBackup();
      resolve();
    });
  });
}
