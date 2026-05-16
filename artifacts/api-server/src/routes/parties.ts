import { Router } from "express";
import db from "../lib/db.js";

const router = Router();

router.get("/parties", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const q = (req.query.q as string) || "";
  const type = req.query.type as string;
  let sql = "SELECT * FROM parties WHERE firm_id = ?";
  const params: any[] = [firmId];
  if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
  if (type && type !== "Both") { sql += " AND (party_type = ? OR party_type = 'Both')"; params.push(type); }
  sql += " ORDER BY name LIMIT 50";
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapParty));
});

router.post("/parties", (req, res) => {
  const { firmId, name, address, gstNumber, phone, email, partyType } = req.body;
  if (!firmId || !name) { res.status(400).json({ error: "firmId and name required" }); return; }
  try {
    const r = db.prepare(
      "INSERT OR REPLACE INTO parties (firm_id, name, address, gst_number, phone, email, party_type) VALUES (?,?,?,?,?,?,?)"
    ).run(firmId, name, address || null, gstNumber || null, phone || null, email || null, partyType || "Both");
    const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(mapParty(party));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/parties/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, address, gstNumber, phone, email, partyType } = req.body;
  db.prepare("UPDATE parties SET name=?, address=?, gst_number=?, phone=?, email=?, party_type=? WHERE id=?")
    .run(name, address || null, gstNumber || null, phone || null, email || null, partyType || "Both", id);
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(id);
  res.json(mapParty(party));
});

router.delete("/parties/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("DELETE FROM parties WHERE id = ?").run(id);
  res.json({ message: "Deleted" });
});

function mapParty(p: any) {
  return { id: p.id, firmId: p.firm_id, name: p.name, address: p.address, gstNumber: p.gst_number, phone: p.phone, email: p.email, partyType: p.party_type, createdAt: p.created_at };
}

export default router;
