import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, Scale, FileSpreadsheet, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GstSummary { sales: any[]; purchases: any[]; saleTotals: { taxable: number; cgst: number; sgst: number; igst: number }; purchaseTotals: { taxable: number; cgst: number; sgst: number; igst: number }; netPayable: { cgst: number; sgst: number; igst: number; total: number }; }
interface TrialBalance { accounts: { name: string; drTotal: number; crTotal: number; balance: number; side: string }[]; totals: { dr: number; cr: number }; }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function GstPage() {
  const { activeFirm } = useAppContext();
  const firmId = activeFirm?.id || 0;
  const [activeTab, setActiveTab] = useState("gst");
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: gst, isLoading: gstLoading } = useQuery<GstSummary>({
    queryKey: ["gst-summary", firmId, month, year],
    queryFn: async () => { const r = await fetch(`/api/gst/summary?firmId=${firmId}&month=${month}&year=${year}`); return r.json(); },
    enabled: !!activeFirm && activeTab === "gst",
  });

  const { data: trial } = useQuery<TrialBalance>({
    queryKey: ["trial-balance", firmId],
    queryFn: async () => { const r = await fetch(`/api/gst/trial-balance?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm && activeTab === "trial",
  });

  const { data: cheques = [] } = useQuery<any[]>({
    queryKey: ["cheques", firmId],
    queryFn: async () => { const r = await fetch(`/api/cheques?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm && activeTab === "cheques",
  });

  const formatCurrency = (v: number = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
          <Receipt className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black">GST & Trial Balance</h1>
          <p className="text-xs text-muted-foreground">GSTR summary, Trial Balance and Cheque Register</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b border-border/40 rounded-none h-auto bg-transparent p-0 gap-6 w-full justify-start">
          {[{ val:"gst", label:"GST Summary (GSTR-3B)" }, { val:"trial", label:"Trial Balance" }, { val:"cheques", label:"Cheque Register" }].map(t => (
            <TabsTrigger key={t.val} value={t.val} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-2 text-sm font-semibold text-muted-foreground">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* GST Summary */}
        <TabsContent value="gst" className="mt-4 space-y-4">
          <div className="flex gap-3 items-center">
            <select value={month} onChange={e => setMonth(e.target.value)} className="h-9 px-3 rounded-xl bg-card border border-border/50 text-sm">
              {MONTHS.map((m,i) => <option key={m} value={String(i+1).padStart(2,"0")}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)} className="h-9 px-3 rounded-xl bg-card border border-border/50 text-sm">
              {Array.from({length:5},(_,i)=>now.getFullYear()-i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {gst && (
            <div className="space-y-4">
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Sales Taxable", value: gst.saleTotals.taxable, color: "text-emerald-400", icon: TrendingUp },
                  { label: "GST Collected", value: gst.saleTotals.cgst + gst.saleTotals.sgst + gst.saleTotals.igst, color: "text-blue-400", icon: Receipt },
                  { label: "Purchase Taxable", value: gst.purchaseTotals.taxable, color: "text-amber-400", icon: TrendingDown },
                  { label: "ITC (Input Credit)", value: gst.purchaseTotals.cgst + gst.purchaseTotals.sgst + gst.purchaseTotals.igst, color: "text-purple-400", icon: CheckCircle2 },
                ].map(k => (
                  <div key={k.label} className="stat-card">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{k.label}</div>
                    <div className={cn("text-lg font-black tabular-nums", k.color)}>{formatCurrency(k.value)}</div>
                  </div>
                ))}
              </div>

              {/* Net Payable */}
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Net GST Payable to Government</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "CGST Payable", value: gst.netPayable.cgst },
                    { label: "SGST Payable", value: gst.netPayable.sgst },
                    { label: "IGST Payable", value: gst.netPayable.igst },
                    { label: "Total Payable", value: gst.netPayable.total, highlight: true },
                  ].map(k => (
                    <div key={k.label} className={cn("rounded-xl p-3", k.highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30")}>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{k.label}</div>
                      <div className={cn("text-lg font-black tabular-nums", k.value >= 0 ? "text-red-400" : "text-emerald-400", k.highlight && "text-primary")}>
                        {formatCurrency(Math.abs(k.value))} {k.value < 0 ? "(Refund)" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!gst && !gstLoading && <p className="text-muted-foreground text-sm py-8 text-center">No GST data for selected period.</p>}
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial" className="mt-4">
          {trial && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{trial.accounts.length} accounts</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-blue-400">Dr Total: {formatCurrency(trial.totals.dr)}</span>
                  <span>·</span>
                  <span className="text-red-400">Cr Total: {formatCurrency(trial.totals.cr)}</span>
                  {Math.abs(trial.totals.dr - trial.totals.cr) < 1 && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25 text-[10px]">Balanced ✓</Badge>}
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40">
                      <TableHead className="text-xs">Account Name</TableHead>
                      <TableHead className="text-xs text-right">Dr Total</TableHead>
                      <TableHead className="text-xs text-right">Cr Total</TableHead>
                      <TableHead className="text-xs text-right">Closing Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trial.accounts.map(acc => (
                      <TableRow key={acc.name} className="border-border/30 hover:bg-muted/20">
                        <TableCell className="py-2 font-medium text-sm">{acc.name}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-blue-400">{acc.drTotal > 0 ? formatCurrency(acc.drTotal) : "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-red-400">{acc.crTotal > 0 ? formatCurrency(acc.crTotal) : "—"}</TableCell>
                        <TableCell className="text-right font-bold text-sm tabular-nums">
                          <span className={acc.side === "Dr" ? "text-blue-400" : "text-red-400"}>
                            {formatCurrency(Math.abs(acc.balance))} {acc.side}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-border bg-muted/20 font-black">
                      <TableCell className="py-2 text-sm">TOTAL</TableCell>
                      <TableCell className="text-right text-blue-400 tabular-nums">{formatCurrency(trial.totals.dr)}</TableCell>
                      <TableCell className="text-right text-red-400 tabular-nums">{formatCurrency(trial.totals.cr)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {!trial && <p className="text-muted-foreground text-sm py-8 text-center">No ledger entries found.</p>}
        </TabsContent>

        {/* Cheque Register */}
        <TabsContent value="cheques" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Voucher No</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Cheque No</TableHead>
                  <TableHead className="text-xs">Bank</TableHead>
                  <TableHead className="text-xs">Party</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((c: any) => (
                  <TableRow key={c.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="text-xs py-2.5 text-muted-foreground">{c.date}</TableCell>
                    <TableCell className="font-mono text-xs text-amber-400/80">{c.voucherNo}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.voucherType}</Badge></TableCell>
                    <TableCell className="font-mono text-sm font-bold">{c.chequeNo}</TableCell>
                    <TableCell className="text-sm">{c.bankName || "—"}</TableCell>
                    <TableCell className="font-semibold text-sm">{c.particulars || "—"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(c.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-[10px] border",
                        c.chequeStatus === "Cleared" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                        c.chequeStatus === "Bounced" ? "bg-red-500/10 text-red-400 border-red-500/25" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/25"
                      )}>{c.chequeStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!cheques.length && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No cheque transactions recorded yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
