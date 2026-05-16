import { Router } from "express";
import db from "../lib/db.js";

const router = Router();

router.get("/items", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const q = (req.query.q as string) || "";
  let sql = "SELECT * FROM items WHERE firm_id = ?";
  const params: any[] = [firmId];
  if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
  sql += " ORDER BY name LIMIT 50";
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapItem));
});

router.post("/items", (req, res) => {
  const { firmId, name, hsnCode, unit, rate, gstRate, description } = req.body;
  if (!firmId || !name) { res.status(400).json({ error: "firmId and name required" }); return; }
  try {
    const r = db.prepare(
      "INSERT OR REPLACE INTO items (firm_id, name, hsn_code, unit, rate, gst_rate, description) VALUES (?,?,?,?,?,?,?)"
    ).run(firmId, name, hsnCode || null, unit || "PCS", rate || 0, gstRate ?? 18, description || null);
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(mapItem(item));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/items/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, hsnCode, unit, rate, gstRate, description } = req.body;
  db.prepare("UPDATE items SET name=?, hsn_code=?, unit=?, rate=?, gst_rate=?, description=? WHERE id=?")
    .run(name, hsnCode || null, unit || "PCS", rate || 0, gstRate ?? 18, description || null, id);
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  res.json(mapItem(item));
});

router.delete("/items/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
  res.json({ message: "Deleted" });
});

function mapItem(i: any) {
  return { id: i.id, firmId: i.firm_id, name: i.name, hsnCode: i.hsn_code, unit: i.unit, rate: i.rate, gstRate: i.gst_rate, description: i.description, createdAt: i.created_at };
}

export default router;
