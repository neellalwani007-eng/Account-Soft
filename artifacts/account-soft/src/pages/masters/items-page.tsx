import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { id: number; firmId: number; name: string; hsnCode?: string; unit?: string; rate?: number; gstRate?: number; description?: string; }

const GST_RATES = [0, 5, 12, 18, 28];

export default function ItemsPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firmId = activeFirm?.id || 0;

  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", hsnCode: "", unit: "PCS", rate: "", gstRate: "18", description: "" });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["items", firmId],
    queryFn: async () => { const r = await fetch(`/api/items?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingItem ? `/api/items/${editingItem.id}` : "/api/items";
      const method = editingItem ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firmId, ...data, rate: parseFloat(data.rate)||0, gstRate: parseFloat(data.gstRate)||0 }) });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", firmId] });
      queryClient.invalidateQueries({ queryKey: ["items-sales", firmId] });
      toast({ title: editingItem ? "Item Updated" : "Item Added" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/items/${id}`, { method: "DELETE" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["items", firmId] }); toast({ title: "Item Deleted" }); },
  });

  const resetForm = () => { setEditingItem(null); setForm({ name: "", hsnCode: "", unit: "PCS", rate: "", gstRate: "18", description: "" }); };
  const startEdit = (item: Item) => {
    setEditingItem(item);
    setForm({ name: item.name, hsnCode: item.hsnCode||"", unit: item.unit||"PCS", rate: String(item.rate||""), gstRate: String(item.gstRate??18), description: item.description||"" });
  };

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.hsnCode||"").includes(search));
  const formatCurrency = (v: number = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Package className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black">Item Master</h1>
          <p className="text-xs text-muted-foreground">Product & service catalogue with HSN, rate and GST%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            {editingItem ? <Edit2 className="w-3.5 h-3.5 text-primary" /> : <Plus className="w-3.5 h-3.5 text-primary" />}
            {editingItem ? "Edit Item" : "Add New Item"}
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Item Name *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Product or service name" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">HSN Code</Label>
                <Input value={form.hsnCode} onChange={e => setForm({...form, hsnCode: e.target.value})} placeholder="XXXXXX" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Unit</Label>
                <Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="PCS, KG…" className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Default Rate ₹</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                <Input type="number" className="pl-7 h-9" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">GST Rate %</Label>
              <div className="flex flex-wrap gap-1.5">
                {GST_RATES.map(r => (
                  <button key={r} onClick={() => setForm({...form, gstRate: String(r)})}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                      form.gstRate === String(r) ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40")}>
                    {r}%
                  </button>
                ))}
                <input type="number" value={GST_RATES.includes(Number(form.gstRate)) ? "" : form.gstRate}
                  onChange={e => setForm({...form, gstRate: e.target.value})} placeholder="Other"
                  className="w-16 h-7 px-2 rounded-lg border border-border/50 bg-input text-xs text-center" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
              <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional details" className="h-9" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 btn-glow-gold rounded-xl h-9 font-bold" onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
              {editingItem ? "Update" : "Add Item"}
            </Button>
            {editingItem && <Button variant="ghost" className="rounded-xl h-9 px-3" onClick={resetForm}>Cancel</Button>}
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Search items or HSN code…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="text-xs">Item Name</TableHead>
                  <TableHead className="text-xs">HSN</TableHead>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs text-center">GST%</TableHead>
                  <TableHead className="w-20 text-center text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{item.name}</div>
                          {item.description && <div className="text-[10px] text-muted-foreground">{item.description}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.hsnCode || "—"}</TableCell>
                    <TableCell className="text-xs">{item.unit || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-emerald-400">{formatCurrency(item.rate||0)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/25">{item.gstRate ?? 18}%</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-primary/60 hover:text-primary" onClick={() => startEdit(item)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400/60 hover:text-red-400" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    {search ? "No matches" : "No items yet. Add your first product or service."}
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
