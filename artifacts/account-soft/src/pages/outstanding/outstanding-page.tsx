import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, TrendingUp, TrendingDown, IndianRupee, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface OutstandingRow { id: number; date: string; voucherNo: string; partyName: string; grandTotal: number; paidAmount: number; balance: number; narration?: string; }

export default function OutstandingPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firmId = activeFirm?.id || 0;
  const [activeTab, setActiveTab] = useState("receivables");
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const { data: receivables = [] } = useQuery<OutstandingRow[]>({
    queryKey: ["receivables", firmId],
    queryFn: async () => { const r = await fetch(`/api/outstanding/receivables?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm && activeTab === "receivables",
  });

  const { data: payables = [] } = useQuery<OutstandingRow[]>({
    queryKey: ["payables", firmId],
    queryFn: async () => { const r = await fetch(`/api/outstanding/payables?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm && activeTab === "payables",
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ voucherId, paidAmount }: { voucherId: number; paidAmount: number }) => {
      const r = await fetch("/api/outstanding/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherId, paidAmount }) });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables", firmId] });
      queryClient.invalidateQueries({ queryKey: ["payables", firmId] });
      toast({ title: "✓ Payment recorded" });
      setPayingId(null); setPayAmount("");
    },
  });

  const formatCurrency = (v: number = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

  const totalReceivables = receivables.reduce((s, r) => s + r.balance, 0);
  const totalPayables = payables.reduce((s, r) => s + r.balance, 0);

  const ageColor = (date: string) => {
    const days = differenceInDays(new Date(), new Date(date));
    if (days > 90) return "text-red-400";
    if (days > 30) return "text-amber-400";
    return "text-emerald-400";
  };

  const OutstandingTable = ({ rows, type }: { rows: OutstandingRow[]; type: "receivable" | "payable" }) => (
    <div className="glass-card rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40">
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Invoice No</TableHead>
            <TableHead className="text-xs">Party</TableHead>
            <TableHead className="text-xs text-right">Invoice</TableHead>
            <TableHead className="text-xs text-right">Paid</TableHead>
            <TableHead className="text-xs text-right">Balance</TableHead>
            <TableHead className="text-xs">Age</TableHead>
            <TableHead className="w-28 text-center text-xs">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const days = differenceInDays(new Date(), new Date(row.date));
            const isPaying = payingId === row.id;
            return (
              <TableRow key={row.id} className="border-border/30 hover:bg-muted/20">
                <TableCell className="text-xs py-2.5 text-muted-foreground">{format(new Date(row.date), "dd/MM/yy")}</TableCell>
                <TableCell className="font-mono text-xs text-amber-400/80">{row.voucherNo}</TableCell>
                <TableCell className="py-2.5">
                  <div className="font-semibold text-sm">{row.partyName}</div>
                  {row.narration && <div className="text-[10px] text-muted-foreground">{row.narration}</div>}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatCurrency(row.grandTotal)}</TableCell>
                <TableCell className="text-right text-sm text-emerald-400 tabular-nums">{formatCurrency(row.paidAmount)}</TableCell>
                <TableCell className="text-right font-black text-sm tabular-nums" style={{ color: type === "receivable" ? "#34d399" : "#f87171" }}>
                  {formatCurrency(row.balance)}
                </TableCell>
                <TableCell className={cn("text-xs font-semibold", ageColor(row.date))}>
                  {days}d
                </TableCell>
                <TableCell className="py-2">
                  {isPaying ? (
                    <div className="flex gap-1">
                      <Input type="number" className="h-7 w-20 text-xs" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                      <Button size="sm" className="h-7 text-xs px-2 rounded-lg" onClick={() => paymentMutation.mutate({ voucherId: row.id, paidAmount: parseFloat(payAmount) || 0 })}>
                        <CheckCircle2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg" onClick={() => setPayingId(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3 rounded-lg border-primary/30 hover:border-primary/60 hover:bg-primary/10" onClick={() => { setPayingId(row.id); setPayAmount(String(row.balance)); }}>
                      Record Payment
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
              All {type === "receivable" ? "receivables" : "payables"} are cleared!
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <AlertCircle className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black">Outstanding</h1>
          <p className="text-xs text-muted-foreground">Track unpaid receivables and payables</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card border-emerald-500/20" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider">To Receive</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 tabular-nums">{formatCurrency(totalReceivables)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{receivables.length} outstanding invoices</div>
        </div>
        <div className="stat-card border-red-500/20" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(185,28,28,0.04))" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-400/70 uppercase tracking-wider">To Pay</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 tabular-nums">{formatCurrency(totalPayables)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{payables.length} outstanding bills</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b border-border/40 rounded-none h-auto bg-transparent p-0 gap-6 w-full justify-start">
          <TabsTrigger value="receivables" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-2 text-sm font-semibold text-muted-foreground">
            Receivables ({receivables.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-2 text-sm font-semibold text-muted-foreground">
            Payables ({payables.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="receivables" className="mt-4"><OutstandingTable rows={receivables} type="receivable" /></TabsContent>
        <TabsContent value="payables" className="mt-4"><OutstandingTable rows={payables} type="payable" /></TabsContent>
      </Tabs>
    </div>
  );
}
