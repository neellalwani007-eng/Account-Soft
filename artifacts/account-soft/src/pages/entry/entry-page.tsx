import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAppContext } from "@/contexts/app-context";
import {
  useListVouchers,
  useCreateVoucher,
  useDeleteManyVouchers,
  useGetNextVoucherNumber,
  useGetCashBalance,
  useListClosedDays,
  useVerifyDayClosePassword,
  useListLedgers,
  useCloseDay
} from "@workspace/api-client-react";
import type { CreateVoucherBody, ListVouchersParams, GetNextVoucherNumberParams, GetCashBalanceParams, ListClosedDaysParams, ListLedgersParams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Trash2, Printer, FileText, Zap, ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { printCashVoucher, exportCashVoucherWord } from "@/lib/print-voucher";
import type { CashVoucher, FirmInfo } from "@/lib/print-voucher";
import { AutocompleteInput } from "@/components/voucher/autocomplete-input";

type VoucherType = "Cash Receipt" | "Cash Payment" | "Bank" | "Journal" | "Sale" | "Purchase";

const VOUCHER_CONFIG: Record<VoucherType, { color: string; activeClass: string; key: string; posting: string }> = {
  "Cash Receipt": { color: "text-emerald-400", activeClass: "active-receipt", key: "F1", posting: "Dr Cash · Cr Account" },
  "Cash Payment": { color: "text-red-400", activeClass: "active-payment", key: "F2", posting: "Dr Account · Cr Cash" },
  "Bank":         { color: "text-blue-400", activeClass: "active-bank", key: "F3", posting: "Dr/Cr Bank Account" },
  "Journal":      { color: "text-purple-400", activeClass: "active-journal", key: "F4", posting: "Dr/Cr Ledger Accounts" },
  "Sale":         { color: "text-amber-400", activeClass: "active-sale", key: "F5", posting: "Sales Voucher →" },
  "Purchase":     { color: "text-cyan-400", activeClass: "active-purchase", key: "F6", posting: "Purchase Voucher →" },
};

export default function EntryPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [voucherType, setVoucherType] = useState<VoucherType>("Cash Receipt");
  const [date, setDate] = useState<Date>(new Date());
  const [particulars, setParticulars] = useState("");
  const [ledgerName, setLedgerName] = useState("");
  const [amount, setAmount] = useState("");
  const [drLedger, setDrLedger] = useState("");
  const [crLedger, setCrLedger] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");

  const [selectedVouchers, setSelectedVouchers] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [negativeCashDialogOpen, setNegativeCashDialogOpen] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const firmId = activeFirm?.id || 0;

  const nextVoucherParams: GetNextVoucherNumberParams = { firmId };
  const { data: nextVoucherData, refetch: refetchNextVoucher } = useGetNextVoucherNumber(
    nextVoucherParams,
    { query: { queryKey: ["nextVoucher", nextVoucherParams], enabled: !!activeFirm } }
  );

  const listVouchersParams: ListVouchersParams = { firmId, limit: 25 };
  const { data: voucherList, refetch: refetchVouchers } = useListVouchers(
    listVouchersParams,
    { query: { queryKey: ["vouchers", listVouchersParams], enabled: !!activeFirm } }
  );

  const cashParams: GetCashBalanceParams = { firmId };
  const { data: cashBalanceData, refetch: refetchCash } = useGetCashBalance(
    cashParams,
    { query: { queryKey: ["cashBalance", cashParams], enabled: !!activeFirm } }
  );

  const closedDaysParams: ListClosedDaysParams = { firmId };
  const { data: closedDays = [] } = useListClosedDays(
    closedDaysParams,
    { query: { queryKey: ["closedDays", closedDaysParams], enabled: !!activeFirm } }
  );

  const ledgersParams: ListLedgersParams = { firmId };
  const { data: ledgers = [] } = useListLedgers(
    ledgersParams,
    { query: { queryKey: ["ledgers", ledgersParams], enabled: !!activeFirm } }
  );

  const { data: particularsRaw = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["particulars-list", firmId],
    queryFn: async () => {
      const r = await fetch(`/api/particulars?firmId=${firmId}`);
      return r.json();
    },
    enabled: !!activeFirm,
  });

  const { data: partiesRaw = [] } = useQuery<{ id: number; name: string; address?: string; gstNumber?: string }[]>({
    queryKey: ["parties-ac", firmId],
    queryFn: async () => {
      const r = await fetch(`/api/parties?firmId=${firmId}`);
      return r.json();
    },
    enabled: !!activeFirm,
  });

  const createVoucherMutation = useCreateVoucher();
  const deleteManyVouchersMutation = useDeleteManyVouchers();
  const closeDayMutation = useCloseDay();
  const verifyPasswordMutation = useVerifyDayClosePassword();

  const firm: FirmInfo = {
    name: activeFirm?.name ?? "Firm",
    address: activeFirm?.address ?? undefined,
    gstNumber: activeFirm?.gstNumber ?? undefined,
    phone: activeFirm?.phone ?? undefined,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); setVoucherType("Cash Receipt"); }
      if (e.key === "F2") { e.preventDefault(); setVoucherType("Cash Payment"); }
      if (e.key === "F3") { e.preventDefault(); setVoucherType("Bank"); }
      if (e.key === "F4") { e.preventDefault(); setVoucherType("Journal"); }
      if (e.key === "F5") { e.preventDefault(); navigate("/sales?tab=new-sale"); }
      if (e.key === "F6") { e.preventDefault(); navigate("/sales?tab=new-purchase"); }
      if (e.key === "Delete" && e.altKey && selectedVouchers.length > 0) setIsDeleting(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedVouchers]);

  // Bank smart detection
  useEffect(() => {
    const bankKeywords = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "DD", "TRANSFER", "HDFC", "SBI", "ICICI", "AXIS"];
    if (bankKeywords.some(kw => particulars.toUpperCase().includes(kw))) {
      setVoucherType("Bank");
    }
  }, [particulars]);

  const handleSave = async () => {
    if (!activeFirm) return;
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    const isClosed = closedDays.includes(format(date, "yyyy-MM-dd"));
    if (isClosed) { setPasswordDialogOpen(true); return; }
    if (voucherType === "Cash Payment" && cashBalanceData && cashBalanceData.balance < parseFloat(amount)) {
      setNegativeCashDialogOpen(true); return;
    }
    proceedWithSave();
  };

  const proceedWithSave = async () => {
    try {
      const body: CreateVoucherBody = {
        firmId: activeFirm!.id,
        date: format(date, "yyyy-MM-dd"),
        voucherType,
        particulars,
        ledgerName: ledgerName || undefined,
        amount: parseFloat(amount),
        drLedger: (voucherType === "Journal" || voucherType === "Bank") ? drLedger : undefined,
        crLedger: (voucherType === "Journal" || voucherType === "Bank") ? crLedger : undefined,
        chequeNo: voucherType === "Bank" ? chequeNo || undefined : undefined,
        bankName: voucherType === "Bank" ? bankName || undefined : undefined,
      } as any;
      await createVoucherMutation.mutateAsync({ data: body });
      toast({ title: "✓ Entry saved" });
      clearForm();
      refetchVouchers(); refetchNextVoucher(); refetchCash();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    }
  };

  const clearForm = () => {
    setParticulars(""); setLedgerName(""); setAmount("");
    setDrLedger(""); setCrLedger(""); setChequeNo(""); setBankName("");
  };

  const handleDeleteSelected = async () => {
    if (!activeFirm) return;
    try {
      await deleteManyVouchersMutation.mutateAsync({
        data: { ids: selectedVouchers, firmId: activeFirm.id, password: "" }
      });
      setSelectedVouchers([]); setIsDeleting(false);
      refetchVouchers(); refetchCash();
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Delete failed", variant: "destructive" });
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

  const particularsOptions = [
    ...particularsRaw.map(p => ({ label: p.name })),
    ...ledgers.map(l => ({ label: l.name, sublabel: l.groupName })),
  ].filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);

  const partyOptions = partiesRaw.map(p => ({ label: p.name, sublabel: p.gstNumber || "", data: p }));

  const config = VOUCHER_CONFIG[voucherType];
  const isBankOrJournal = voucherType === "Bank" || voucherType === "Journal";

  return (
    <div className="p-5 grid grid-cols-1 xl:grid-cols-5 gap-5 h-full min-h-screen">
      {/* LEFT: Entry Form */}
      <div className="xl:col-span-2 space-y-4 flex flex-col">

        {/* Voucher Type Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(VOUCHER_CONFIG) as VoucherType[]).map((type) => {
            const c = VOUCHER_CONFIG[type];
            const isActive = voucherType === type;
            const isSalePurchase = type === "Sale" || type === "Purchase";
            return (
              <button
                key={type}
                className={cn(
                  "voucher-btn py-2.5 px-2 text-center",
                  isSalePurchase
                    ? "inactive border border-dashed border-border/60 opacity-80 hover:opacity-100 hover:border-primary/40 transition-all"
                    : isActive ? c.activeClass : "inactive"
                )}
                onClick={() => {
                  if (isSalePurchase) {
                    navigate(type === "Sale" ? "/sales?tab=new-sale" : "/sales?tab=new-purchase");
                  } else {
                    setVoucherType(type);
                  }
                }}
              >
                <div className="text-[10px] font-mono opacity-60 mb-0.5">{c.key}</div>
                <div className="text-xs font-bold leading-tight">
                  {isSalePurchase ? `${type} →` : type}
                </div>
                {isSalePurchase && (
                  <div className="text-[9px] opacity-50 mt-0.5">Invoice page</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Status Bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-xs">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0 relative", config.color.replace("text-", "bg-"))}>
            <div className={cn("absolute inset-0 rounded-full animate-ping opacity-40", config.color.replace("text-", "bg-"))} />
          </div>
          <span className="text-muted-foreground">Posting:</span>
          <span className={cn("font-semibold", config.color)}>{config.posting}</span>
          {voucherType === "Bank" && <Badge className="ml-auto text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/30">BANK MODE</Badge>}
        </div>

        {/* Entry Card */}
        <div className="glass-card rounded-2xl p-5 space-y-4 flex-1">
          {/* Date + Voucher No */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm border-border/60 hover:border-primary/40">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {format(date, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Voucher No</Label>
              <div className="h-9 flex items-center px-3 rounded-lg bg-amber-500/8 border border-amber-500/25 font-mono text-sm font-bold text-amber-400 tracking-wide">
                {nextVoucherData?.voucherNo || "AUTO"}
              </div>
            </div>
          </div>

          {/* Particulars (Account name) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Particulars <span className="text-primary/60">(Account)</span>
            </Label>
            <AutocompleteInput
              value={particulars}
              onChange={setParticulars}
              suggestions={particularsOptions}
              placeholder="Start typing account or ledger name…"
            />
          </div>

          {/* Ledger Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Ledger Name
            </Label>
            <AutocompleteInput
              value={ledgerName}
              onChange={setLedgerName}
              suggestions={particularsOptions}
              placeholder="Ledger to post to…"
            />
          </div>

          {/* Bank + Journal: Dr/Cr Ledgers */}
          {isBankOrJournal && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-blue-400/80 uppercase tracking-wide">Dr Ledger</Label>
                <AutocompleteInput
                  value={drLedger}
                  onChange={setDrLedger}
                  suggestions={ledgers.map(l => ({ label: l.name, sublabel: l.groupName }))}
                  placeholder="Debit account…"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-red-400/80 uppercase tracking-wide">Cr Ledger</Label>
                <AutocompleteInput
                  value={crLedger}
                  onChange={setCrLedger}
                  suggestions={ledgers.map(l => ({ label: l.name, sublabel: l.groupName }))}
                  placeholder="Credit account…"
                />
              </div>
            </div>
          )}

          {/* Bank cheque fields */}
          {voucherType === "Bank" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cheque No</Label>
                <Input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Name</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC" className="h-9 text-sm" />
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount ₹</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
              <Input
                ref={amountRef}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-lg font-black h-12 border-primary/30 focus:border-primary/60"
                style={{ boxShadow: amount ? "0 0 0 1px rgba(14,165,233,0.2)" : undefined }}
                placeholder="0.00"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 h-11 font-black text-sm rounded-xl btn-glow-blue gap-2"
              onClick={handleSave}
              disabled={createVoucherMutation.isPending}
            >
              <Zap className="w-4 h-4" />
              SAVE ENTRY
              <span className="text-[10px] opacity-60 font-mono ml-1">Enter</span>
            </Button>
            <Button variant="outline" className="h-11 px-4 rounded-xl border-border/60 hover:border-primary/30" onClick={clearForm}>
              Clear
            </Button>
            <Button
              variant="ghost"
              className="h-11 px-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={async () => {
                if (!activeFirm) return;
                await closeDayMutation.mutateAsync({ data: { firmId: activeFirm.id, date: format(date, "yyyy-MM-dd") } });
                toast({ title: "Day Closed", description: "Entries locked for " + format(date, "dd MMM yyyy") });
              }}
            >
              <Lock className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT: Recent Entries */}
      <div className="xl:col-span-3 glass-card rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">Recent Entries</h2>
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {voucherList?.vouchers.length || 0}
            </Badge>
          </div>
          {selectedVouchers.length > 0 && (
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={() => setIsDeleting(true)}>
              <Trash2 className="w-3 h-3" />
              Delete ({selectedVouchers.length})
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/90 backdrop-blur-sm z-10">
              <TableRow className="border-border/40">
                <TableHead className="w-8">
                  <Checkbox
                    checked={selectedVouchers.length === (voucherList?.vouchers.length || 0) && (voucherList?.vouchers.length || 0) > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedVouchers(voucherList?.vouchers.map(v => v.id) || []);
                      else setSelectedVouchers([]);
                    }}
                  />
                </TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">No</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Account / Ledger</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="w-14 text-center text-xs">Act</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voucherList?.vouchers.map((v) => {
                const isReceipt = v.voucherType === "Cash Receipt" || v.voucherType === "Receipt";
                const isPayment = v.voucherType === "Cash Payment" || v.voucherType === "Payment";
                const isBank = v.voucherType === "Bank";
                const isJournal = v.voucherType === "Journal";
                return (
                  <TableRow
                    key={v.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors border-border/30",
                      isReceipt && "table-row-receipt",
                      isPayment && "table-row-payment",
                      isBank && "table-row-bank",
                      isJournal && "table-row-journal",
                    )}
                  >
                    <TableCell className="py-2">
                      <Checkbox
                        checked={selectedVouchers.includes(v.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedVouchers([...selectedVouchers, v.id]);
                          else setSelectedVouchers(selectedVouchers.filter(id => id !== v.id));
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-xs py-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(v.date), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] py-2 text-amber-400/80">{v.voucherNo}</TableCell>
                    <TableCell className="py-2">
                      <Badge className={cn(
                        "text-[9px] px-1.5 py-0 border font-bold",
                        isReceipt && "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
                        isPayment && "bg-red-500/10 text-red-400 border-red-500/25",
                        isBank && "bg-blue-500/10 text-blue-400 border-blue-500/25",
                        isJournal && "bg-purple-500/10 text-purple-400 border-purple-500/25",
                        !isReceipt && !isPayment && !isBank && !isJournal && "bg-muted text-muted-foreground border-border",
                      )}>
                        {isReceipt ? "RCP" : isPayment ? "PMT" : isBank ? "BNK" : isJournal ? "JNL" : v.voucherType.slice(0,3).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 max-w-[160px]">
                      <div className="text-xs font-semibold truncate">{v.particulars}</div>
                      {(v as any).ledgerName && <div className="text-[10px] text-primary/70 truncate">{(v as any).ledgerName}</div>}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold text-sm py-2 tabular-nums",
                      isReceipt ? "text-emerald-400" : isPayment ? "text-red-400" : "text-foreground"
                    )}>
                      {formatCurrency(v.amount)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-0.5 justify-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10" onClick={() => {
                          const cv: CashVoucher = { voucherNo: v.voucherNo, date: v.date, voucherType: v.voucherType, particulars: v.particulars, person: (v as any).person, amount: v.amount, narration: (v as any).narration };
                          printCashVoucher(cv, firm);
                        }}>
                          <Printer className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/10" onClick={() => {
                          const cv: CashVoucher = { voucherNo: v.voucherNo, date: v.date, voucherType: v.voucherType, particulars: v.particulars, person: (v as any).person, amount: v.amount, narration: (v as any).narration };
                          exportCashVoucherWord(cv, firm);
                        }}>
                          <FileText className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!voucherList?.vouchers.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <div className="text-sm">No entries yet. Use the form to add your first transaction.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent className="glass-card border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedVouchers.length} voucher(s)?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteSelected}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Negative Cash Warning */}
      <AlertDialog open={negativeCashDialogOpen} onOpenChange={setNegativeCashDialogOpen}>
        <AlertDialogContent className="glass-card border-amber-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠ Negative Cash Warning</AlertDialogTitle>
            <AlertDialogDescription>
              This payment will result in a negative cash balance (Current: {formatCurrency(cashBalanceData?.balance || 0)}). Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setNegativeCashDialogOpen(false); proceedWithSave(); }}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Closed Day Password */}
      <AlertDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>🔒 Day is Closed</AlertDialogTitle>
            <AlertDialogDescription>Enter the supervisor password to post into this closed period.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Input type="password" placeholder="Password…" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") verifyPasswordMutation.mutate({ data: { password } }); }} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPassword("")}>Cancel</AlertDialogCancel>
            <Button onClick={async () => {
              const res = await verifyPasswordMutation.mutateAsync({ data: { password } });
              if (res.valid) { setPasswordDialogOpen(false); proceedWithSave(); }
              else toast({ title: "Wrong password", variant: "destructive" });
            }}>Verify & Save</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
