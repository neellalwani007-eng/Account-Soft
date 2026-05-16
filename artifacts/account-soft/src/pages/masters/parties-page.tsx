import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Users, Search, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Party { id: number; firmId: number; name: string; address?: string; gstNumber?: string; phone?: string; email?: string; partyType: string; }

export default function PartiesPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firmId = activeFirm?.id || 0;

  const [search, setSearch] = useState("");
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [form, setForm] = useState({ name: "", address: "", gstNumber: "", phone: "", email: "", partyType: "Both" });

  const { data: parties = [], isLoading } = useQuery<Party[]>({
    queryKey: ["parties", firmId],
    queryFn: async () => { const r = await fetch(`/api/parties?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingParty ? `/api/parties/${editingParty.id}` : "/api/parties";
      const method = editingParty ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firmId, ...data }) });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties", firmId] });
      queryClient.invalidateQueries({ queryKey: ["parties-sales", firmId] });
      queryClient.invalidateQueries({ queryKey: ["parties-ac", firmId] });
      toast({ title: editingParty ? "Party Updated" : "Party Added" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/parties/${id}`, { method: "DELETE" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["parties", firmId] }); toast({ title: "Party Deleted" }); },
  });

  const resetForm = () => { setEditingParty(null); setForm({ name: "", address: "", gstNumber: "", phone: "", email: "", partyType: "Both" }); };

  const startEdit = (p: Party) => { setEditingParty(p); setForm({ name: p.name, address: p.address || "", gstNumber: p.gstNumber || "", phone: p.phone || "", email: p.email || "", partyType: p.partyType }); };

  const filtered = parties.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.gstNumber || "").includes(search));

  const typeColor = (t: string) =>
    t === "Customer" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
    t === "Supplier" ? "bg-blue-500/10 text-blue-400 border-blue-500/25" :
    "bg-amber-500/10 text-amber-400 border-amber-500/25";

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Users className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black">Party Master</h1>
          <p className="text-xs text-muted-foreground">Customers & Suppliers database with auto-fill</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            {editingParty ? <Edit2 className="w-3.5 h-3.5 text-primary" /> : <Plus className="w-3.5 h-3.5 text-primary" />}
            {editingParty ? "Edit Party" : "Add New Party"}
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Party / Firm name" className="h-9" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Type</Label>
              <div className="flex gap-1 p-1 bg-muted/30 rounded-xl">
                {["Customer", "Supplier", "Both"].map(t => (
                  <button key={t} onClick={() => setForm({...form, partyType: t})}
                    className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      form.partyType === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Address</Label>
              <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full address" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">GST Number</Label>
              <Input value={form.gstNumber} onChange={e => setForm({...form, gstNumber: e.target.value})} placeholder="27XXXXX…" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Phone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Mobile" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
              <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="optional@email.com" className="h-9" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 btn-glow-blue rounded-xl h-9 text-sm font-bold" onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
              {editingParty ? "Update" : "Add Party"}
            </Button>
            {editingParty && <Button variant="ghost" className="rounded-xl h-9 px-3" onClick={resetForm}>Cancel</Button>}
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Search parties…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="text-xs">Party Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">GST No</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="w-20 text-center text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="py-2.5">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-black">{p.name[0]}</span>
                        </div>
                        <div>
                          <div>{p.name}</div>
                          {p.address && <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{p.address}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={cn("text-[10px] border", typeColor(p.partyType))}>{p.partyType}</Badge></TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.gstNumber || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-primary/60 hover:text-primary" onClick={() => startEdit(p)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400/60 hover:text-red-400" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    {search ? "No matches found" : "No parties yet. Add your first customer or supplier."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
