import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import {
  useCreateFirm,
  useUpdateFirm,
  useUpdateSettings,
  useListLedgers,
  useCreateLedger,
  useDeleteLedger,
  useUpdateLedger
} from "@workspace/api-client-react";
import type { Firm, AppSettings, ListLedgersParams } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Settings as SettingsIcon, Users, Trash2, Plus, Edit2, Shield, Database, RefreshCw, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BackupEntry {
  file: string;
  size: number;
  created: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SettingsPage() {
  const { activeFirm, settings, firms } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("firms");

  const [editingFirm, setEditingFirm] = useState<Firm | null>(null);
  const [firmName, setFirmName] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [firmGst, setFirmGst] = useState("");
  const [firmPrefix, setFirmPrefix] = useState("");
  const [firmPhone, setFirmPhone] = useState("");

  const [closePassword, setClosePassword] = useState(settings?.dayClosePassword || "");
  const [autoClose, setAutoClose] = useState(settings?.autoCloseAtMidnight || false);

  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerGroup, setNewLedgerGroup] = useState("Indirect Expenses");
  const [newLedgerOpBal, setNewLedgerOpBal] = useState("");
  const [newLedgerOpBalSide, setNewLedgerOpBalSide] = useState<"Dr" | "Cr">("Dr");

  const [editingLedger, setEditingLedger] = useState<any | null>(null);
  const [editLedgerName, setEditLedgerName] = useState("");
  const [editLedgerGroup, setEditLedgerGroup] = useState("");
  const [editLedgerOpBal, setEditLedgerOpBal] = useState("");
  const [editLedgerOpBalSide, setEditLedgerOpBalSide] = useState<"Dr" | "Cr">("Dr");

  const createFirmMutation = useCreateFirm();
  const updateFirmMutation = useUpdateFirm();
  const updateSettingsMutation = useUpdateSettings();

  const ledgersParams: ListLedgersParams = { firmId: activeFirm?.id || 0 };
  const { data: ledgers = [], refetch: refetchLedgers } = useListLedgers(
    ledgersParams,
    { query: { queryKey: ["ledgers", ledgersParams], enabled: !!activeFirm } }
  );
  const createLedgerMutation = useCreateLedger();
  const deleteLedgerMutation = useDeleteLedger();
  const updateLedgerMutation = useUpdateLedger();

  // ── Backup queries ──────────────────────────────────────────────────────────
  const { data: backups = [], refetch: refetchBackups } = useQuery<BackupEntry[]>({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await fetch("/api/backups");
      if (!res.ok) throw new Error("Failed to load backups");
      return res.json();
    },
    enabled: activeTab === "backup",
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error("Backup failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Backup Created", description: `Saved: ${data.file} (${formatBytes(data.size)})` });
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err: any) => {
      toast({ title: "Backup Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveFirm = async () => {
    try {
      const data = {
        name: firmName,
        address: firmAddress,
        gstNumber: firmGst,
        prefix: firmPrefix,
        phone: firmPhone,
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString()
      };
      if (editingFirm) {
        await updateFirmMutation.mutateAsync({ id: editingFirm.id, data });
        toast({ title: "Firm Updated" });
      } else {
        await createFirmMutation.mutateAsync({ data });
        toast({ title: "Firm Created" });
      }
      setEditingFirm(null);
      setFirmName(""); setFirmAddress(""); setFirmGst(""); setFirmPrefix(""); setFirmPhone("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        data: { ...settings, dayClosePassword: closePassword, autoCloseAtMidnight: autoClose } as AppSettings
      });
      toast({ title: "Settings Saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddLedger = async () => {
    if (!activeFirm || !newLedgerName) return;
    try {
      await createLedgerMutation.mutateAsync({
        data: {
          firmId: activeFirm.id,
          name: newLedgerName,
          groupName: newLedgerGroup,
          openingBalance: parseFloat(newLedgerOpBal) || 0,
          openingBalanceSide: newLedgerOpBalSide,
        } as any
      });
      setNewLedgerName(""); setNewLedgerOpBal("");
      refetchLedgers();
      toast({ title: "Ledger Added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateLedger = async () => {
    if (!activeFirm || !editingLedger) return;
    try {
      await updateLedgerMutation.mutateAsync({
        id: editingLedger.id,
        data: {
          firmId: activeFirm.id,
          name: editLedgerName,
          groupName: editLedgerGroup,
          openingBalance: parseFloat(editLedgerOpBal) || 0,
          openingBalanceSide: editLedgerOpBalSide,
        } as any
      });
      setEditingLedger(null);
      refetchLedgers();
      toast({ title: "Ledger Updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mb-6 w-full justify-start border-b rounded-none h-auto bg-transparent p-0 gap-8">
          <TabsTrigger value="firms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 flex gap-2">
            <Building2 className="w-4 h-4" /> Firm Management
          </TabsTrigger>
          <TabsTrigger value="app" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 flex gap-2">
            <SettingsIcon className="w-4 h-4" /> App Settings
          </TabsTrigger>
          <TabsTrigger value="ledgers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 flex gap-2">
            <Users className="w-4 h-4" /> Ledger Management
          </TabsTrigger>
          <TabsTrigger value="backup" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 flex gap-2">
            <Database className="w-4 h-4" /> Backup & Restore
          </TabsTrigger>
        </TabsList>

        {/* ── Firm Management ── */}
        <TabsContent value="firms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>{editingFirm ? "Edit Firm" : "Add New Firm"}</CardTitle>
                <CardDescription>Setup details for your accounting company</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Firm Name *</Label><Input value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="e.g. Sharma Traders" /></div>
                <div className="space-y-2"><Label>GST Number</Label><Input value={firmGst} onChange={e => setFirmGst(e.target.value)} placeholder="27XXXXX..." /></div>
                <div className="space-y-2"><Label>Voucher Prefix *</Label><Input value={firmPrefix} onChange={e => setFirmPrefix(e.target.value)} placeholder="e.g. KMK" /></div>
                <div className="space-y-2"><Label>Address</Label><Input value={firmAddress} onChange={e => setFirmAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={firmPhone} onChange={e => setFirmPhone(e.target.value)} /></div>
                <Button className="w-full mt-2" onClick={handleSaveFirm}>{editingFirm ? "Update Firm" : "Create Firm"}</Button>
                {editingFirm && <Button variant="ghost" className="w-full" onClick={() => { setEditingFirm(null); setFirmName(""); }}>Cancel</Button>}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 bg-card border rounded-lg overflow-hidden self-start">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm Name</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold">{f.name}</TableCell>
                      <TableCell className="text-xs opacity-70">{f.gstNumber || "N/A"}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-500">{f.prefix}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingFirm(f);
                          setFirmName(f.name);
                          setFirmGst(f.gstNumber || "");
                          setFirmPrefix(f.prefix || "");
                          setFirmAddress(f.address || "");
                          setFirmPhone(f.phone || "");
                        }}><Edit2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!firms.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No firms yet. Add your first firm using the form.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── App Settings ── */}
        <TabsContent value="app" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-red-500" /> Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Day Close Supervisor Password</Label>
                <Input type="password" value={closePassword} onChange={e => setClosePassword(e.target.value)} placeholder="••••••••" />
                <p className="text-xs text-muted-foreground">Required to post entries into closed days. Default: <code>confirm</code></p>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div className="space-y-1">
                  <Label>Auto-Close at Midnight</Label>
                  <p className="text-xs text-muted-foreground">Automatically lock today's entries at 12:00 AM</p>
                </div>
                <Switch checked={autoClose} onCheckedChange={setAutoClose} />
              </div>
              <Button className="w-full" onClick={handleUpdateSettings}>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ledger Management ── */}
        <TabsContent value="ledgers" className="space-y-6">
          {/* Add Ledger Form */}
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Add New Ledger</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-2">
                <Label>Ledger Name *</Label>
                <Input value={newLedgerName} onChange={e => setNewLedgerName(e.target.value)} placeholder="e.g. Electricity Bill" />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input value={newLedgerGroup} onChange={e => setNewLedgerGroup(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Opening Balance ₹</Label>
                <div className="flex gap-1">
                  <Input type="number" value={newLedgerOpBal} onChange={e => setNewLedgerOpBal(e.target.value)} placeholder="0.00" className="flex-1" />
                  <div className="flex p-1 bg-muted/40 rounded-lg gap-0.5">
                    {(["Dr", "Cr"] as const).map(s => (
                      <button key={s} onClick={() => setNewLedgerOpBalSide(s)}
                        className={cn("px-2 py-1 rounded text-xs font-bold transition-all", newLedgerOpBalSide === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleAddLedger} className="gap-2"><Plus className="w-4 h-4" /> Add Ledger</Button>
            </div>
          </div>

          {/* Edit Ledger Dialog */}
          {editingLedger && (
            <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-widest flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Editing: {editingLedger.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-2">
                  <Label>Ledger Name *</Label>
                  <Input value={editLedgerName} onChange={e => setEditLedgerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Group</Label>
                  <Input value={editLedgerGroup} onChange={e => setEditLedgerGroup(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Opening Balance ₹</Label>
                  <div className="flex gap-1">
                    <Input type="number" value={editLedgerOpBal} onChange={e => setEditLedgerOpBal(e.target.value)} placeholder="0.00" className="flex-1" />
                    <div className="flex p-1 bg-muted/40 rounded-lg gap-0.5">
                      {(["Dr", "Cr"] as const).map(s => (
                        <button key={s} onClick={() => setEditLedgerOpBalSide(s)}
                          className={cn("px-2 py-1 rounded text-xs font-bold transition-all", editLedgerOpBalSide === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdateLedger} className="gap-2 flex-1">Save</Button>
                  <Button variant="ghost" onClick={() => setEditingLedger(null)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger Account Name</TableHead>
                  <TableHead>Account Group</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell><Badge variant="outline">{l.groupName}</Badge></TableCell>
                    <TableCell className="text-right">
                      {l.openingBalance ? (
                        <span className={cn("font-semibold tabular-nums", l.openingBalanceSide === "Dr" ? "text-emerald-400" : "text-red-400")}>
                          ₹{Number(l.openingBalance).toLocaleString("en-IN")} {l.openingBalanceSide}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingLedger(l);
                          setEditLedgerName(l.name);
                          setEditLedgerGroup(l.groupName);
                          setEditLedgerOpBal(l.openingBalance ? String(l.openingBalance) : "");
                          setEditLedgerOpBalSide(l.openingBalanceSide || "Dr");
                        }}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => {
                          await deleteLedgerMutation.mutateAsync({ id: l.id });
                          refetchLedgers();
                          toast({ title: "Ledger Deleted" });
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!ledgers.length && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No ledger accounts yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Backup & Restore ── */}
        <TabsContent value="backup" className="space-y-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auto backup info */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" /> Auto-Backup Active
                </CardTitle>
                <CardDescription>
                  Your database is automatically backed up every night at midnight.
                  Up to 30 backups are kept.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>📁 Backup folder: <code className="text-xs bg-muted px-1 rounded">data/backups/</code></p>
                  <p>🗓 Schedule: Daily at 12:00 AM</p>
                  <p>📦 Retention: Last 30 backups</p>
                </div>
              </CardContent>
            </Card>

            {/* Manual backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Manual Backup
                </CardTitle>
                <CardDescription>
                  Create a backup right now without waiting for midnight.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full gap-2"
                  onClick={() => backupMutation.mutate()}
                  disabled={backupMutation.isPending}
                >
                  {backupMutation.isPending
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating backup...</>
                    : <><Database className="w-4 h-4" /> Backup Now</>}
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => refetchBackups()}>
                  <RefreshCw className="w-4 h-4" /> Refresh List
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Backup list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backup History</CardTitle>
              <CardDescription>
                To restore: stop the app, copy the backup file, rename it to <code>accountsoft.db</code>, and place it in the <code>data/</code> folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Backup File</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b, i) => (
                    <TableRow key={b.file} className={i === 0 ? "bg-green-500/5" : ""}>
                      <TableCell className="font-mono text-xs">{b.file}</TableCell>
                      <TableCell className="text-sm">{formatBytes(b.size)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(b.created).toLocaleString("en-IN")}
                        {i === 0 && <Badge className="ml-2 text-[9px] bg-green-500/20 text-green-400 border-green-500/30">Latest</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!backups.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        No backups yet. Click "Backup Now" to create the first one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
