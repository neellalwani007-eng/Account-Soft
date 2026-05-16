import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { useAppContext } from "@/contexts/app-context";
import { useListSales, useCreateSale, useCreatePurchase, useListPurchases } from "@workspace/api-client-react";
import type { ListSalesParams, ListPurchasesParams } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Plus, Trash2, Printer, Save, Tag, FileText, ShoppingCart, Search, User, MapPin, Phone, CreditCard, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { printGstInvoice, exportGstInvoiceWord } from "@/lib/print-voucher";
import type { SaleVoucher, FirmInfo } from "@/lib/print-voucher";
import { AutocompleteInput } from "@/components/voucher/autocomplete-input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type LocalSaleItem = { description: string; hsnCode: string; qty: number; unit: string; rate: number; gstRate: number; };
type InvoiceType = "Sale" | "Purchase";

interface Party { id: number; name: string; address?: string; gstNumber?: string; phone?: string; partyType?: string; }
interface Item { id: number; name: string; hsnCode?: string; unit?: string; rate?: number; gstRate?: number; }

export default function SalesPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firmId = activeFirm?.id || 0;

  const search = useSearch();
  const [activeTab, setActiveTab] = useState("sales-list");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, [search]);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyGst, setPartyGst] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [mode, setMode] = useState<string>("Cash");
  const [isGst, setIsGst] = useState(true);
  const [items, setItems] = useState<LocalSaleItem[]>([
    { description: "", hsnCode: "", qty: 1, unit: "PCS", rate: 0, gstRate: 18 }
  ]);
  const [narration, setNarration] = useState("");
  const [savedSale, setSavedSale] = useState<SaleVoucher | null>(null);

  const salesParams: ListSalesParams = { firmId };
  const { data: sales = [], refetch: refetchSales } = useListSales(salesParams, { query: { queryKey: ["sales", salesParams], enabled: !!activeFirm } });
  const purchasesParams: ListPurchasesParams = { firmId };
  const { data: purchases = [], refetch: refetchPurchases } = useListPurchases(purchasesParams, { query: { queryKey: ["purchases", purchasesParams], enabled: !!activeFirm } });
  const createSaleMutation = useCreateSale();
  const createPurchaseMutation = useCreatePurchase();

  const { data: parties = [] } = useQuery<Party[]>({
    queryKey: ["parties-sales", firmId],
    queryFn: async () => { const r = await fetch(`/api/parties?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm,
  });

  const { data: itemsList = [] } = useQuery<Item[]>({
    queryKey: ["items-sales", firmId],
    queryFn: async () => { const r = await fetch(`/api/items?firmId=${firmId}`); return r.json(); },
    enabled: !!activeFirm,
  });

  const saveItemMutation = useMutation({
    mutationFn: async (itemData: Partial<Item> & { firmId: number }) => {
      const r = await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(itemData) });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items-sales", firmId] }),
  });

  const savePartyMutation = useMutation({
    mutationFn: async (partyData: Partial<Party> & { firmId: number }) => {
      const r = await fetch("/api/parties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partyData) });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["parties-sales", firmId] }),
  });

  const totals = useMemo(() => {
    let subtotal = 0; let cgst = 0; let sgst = 0;
    items.forEach(item => {
      const amt = item.qty * item.rate;
      subtotal += amt;
      if (isGst) { const g = (amt * item.gstRate) / 100; cgst += g / 2; sgst += g / 2; }
    });
    return { subtotal, cgst, sgst, total: subtotal + cgst + sgst };
  }, [items, isGst]);

  const firm: FirmInfo = {
    name: activeFirm?.name ?? "Your Firm",
    address: activeFirm?.address ?? undefined,
    gstNumber: activeFirm?.gstNumber ?? undefined,
    phone: activeFirm?.phone ?? undefined,
  };

  const addItem = () => setItems([...items, { description: "", hsnCode: "", qty: 1, unit: "PCS", rate: 0, gstRate: 18 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof LocalSaleItem, val: any) => {
    const ni = [...items];
    (ni[idx] as any)[field] = ["qty","rate","gstRate"].includes(field) ? parseFloat(val)||0 : val;
    setItems(ni);
    // Auto-save item to master when description is typed
    if (field === "description" && val.length > 2) {
      const existing = itemsList.find(i => i.name.toLowerCase() === val.toLowerCase());
      if (!existing && activeFirm) {
        saveItemMutation.mutate({ firmId: activeFirm.id, name: val, hsnCode: ni[idx].hsnCode || undefined, unit: ni[idx].unit, rate: ni[idx].rate, gstRate: ni[idx].gstRate });
      }
    }
  };

  const onItemSelect = (idx: number, itemName: string, itemData?: Item) => {
    if (itemData) {
      const ni = [...items];
      ni[idx] = { ...ni[idx], description: itemData.name, hsnCode: itemData.hsnCode || "", unit: itemData.unit || "PCS", rate: itemData.rate || 0, gstRate: itemData.gstRate ?? 18 };
      setItems(ni);
    }
  };

  const onPartySelect = (name: string, data?: Party) => {
    if (data) {
      setPartyName(data.name);
      setPartyAddress(data.address || "");
      setPartyGst(data.gstNumber || "");
      setPartyPhone(data.phone || "");
    }
  };

  const clearForm = () => {
    setDate(format(new Date(), "yyyy-MM-dd")); setInvoiceNo(""); setPartyName(""); setPartyAddress(""); setPartyGst(""); setPartyPhone(""); setNarration("");
    setItems([{ description: "", hsnCode: "", qty: 1, unit: "PCS", rate: 0, gstRate: 18 }]);
    setSavedSale(null);
  };

  const handleSave = async (type: InvoiceType) => {
    if (!activeFirm || !partyName) { toast({ title: "Party name is required", variant: "destructive" }); return; }
    try {
      const body: any = {
        firmId: activeFirm.id, date, invoiceNo: invoiceNo || undefined,
        partyName, partyAddress, partyGst, partyPhone,
        paymentMode: mode, isGstInvoice: isGst, narration,
        items: items.map(it => ({ description: it.description, hsnCode: it.hsnCode, qty: it.qty, unit: it.unit, rate: it.rate, gstRate: it.gstRate, amount: it.qty * it.rate }))
      };
      let result: any;
      if (type === "Sale") result = await createSaleMutation.mutateAsync({ data: body });
      else result = await createPurchaseMutation.mutateAsync({ data: body });
      // Auto-save party if new
      const existingParty = parties.find(p => p.name.toLowerCase() === partyName.toLowerCase());
      if (!existingParty) {
        savePartyMutation.mutate({ firmId: activeFirm.id, name: partyName, address: partyAddress || undefined, gstNumber: partyGst || undefined, phone: partyPhone || undefined, partyType: type === "Sale" ? "Customer" : "Supplier" });
      }
      const saved: SaleVoucher = { id: result?.id, voucherNo: result?.voucherNo, date, partyName, partyGst, paymentMode: mode, isGstInvoice: isGst, narration, subtotal: totals.subtotal, cgst: totals.cgst, sgst: totals.sgst, igst: 0, grandTotal: totals.total, items: items.map(it => ({ ...it, amount: it.qty * it.rate })) };
      setSavedSale(saved);
      toast({ title: `✓ ${type} invoice saved` });
      refetchSales(); refetchPurchases();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const currentSale = (): SaleVoucher => savedSale ?? {
    date, partyName, partyGst, paymentMode: mode, isGstInvoice: isGst, narration,
    subtotal: totals.subtotal, cgst: totals.cgst, sgst: totals.sgst, igst: 0, grandTotal: totals.total,
    items: items.map(it => ({ ...it, amount: it.qty * it.rate })),
  };

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

  const InvoiceForm = ({ type }: { type: InvoiceType }) => (
    <div className="space-y-4 pb-4">
      {/* Party Details */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <User className="w-3.5 h-3.5" /> Party Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Your Invoice No</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Leave blank for auto" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Party Name *</Label>
            <AutocompleteInput
              value={partyName}
              onChange={setPartyName}
              onSelect={(name, data) => onPartySelect(name, data)}
              suggestions={parties.map(p => ({ label: p.name, sublabel: p.gstNumber || p.phone || "", data: p }))}
              placeholder={type === "Sale" ? "Customer name…" : "Supplier name…"}
              icon={<User className="w-3.5 h-3.5" />}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9" value={partyAddress} onChange={e => setPartyAddress(e.target.value)} placeholder="Full address…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9" value={partyPhone} onChange={e => setPartyPhone(e.target.value)} placeholder="Mobile number" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">GSTIN</Label>
            <Input value={partyGst} onChange={e => setPartyGst(e.target.value)} placeholder="27XXXXX…" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Mode</Label>
            <div className="flex gap-1 p-1 bg-muted/40 rounded-lg">
              {["Cash", "Bank", "Credit"].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn("flex-1 py-1.5 rounded-md text-xs font-semibold transition-all", mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border border-border/50 rounded-xl px-4 py-2.5 bg-card/40">
            <div>
              <Label className="text-xs font-semibold">GST Invoice</Label>
              <p className="text-[10px] text-muted-foreground">Include CGST/SGST</p>
            </div>
            <Switch checked={isGst} onCheckedChange={setIsGst} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Narration / Remarks</Label>
          <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Optional note…" className="h-9" />
        </div>
      </div>

      {/* Items Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/40">
              <TableHead className="text-xs">Item / Description *</TableHead>
              <TableHead className="w-24 text-xs">HSN</TableHead>
              <TableHead className="w-18 text-xs text-center">Qty</TableHead>
              <TableHead className="w-18 text-xs">Unit</TableHead>
              <TableHead className="w-28 text-xs text-right">Rate ₹</TableHead>
              {isGst && <TableHead className="w-16 text-xs text-center">GST%</TableHead>}
              <TableHead className="w-32 text-xs text-right">Amount ₹</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-1.5 pr-2">
                  <AutocompleteInput
                    value={item.description}
                    onChange={val => updateItem(idx, "description", val)}
                    onSelect={(name, data) => onItemSelect(idx, name, data)}
                    suggestions={itemsList.map(i => ({ label: i.name, sublabel: i.hsnCode ? `HSN: ${i.hsnCode}` : undefined, data: i }))}
                    placeholder="Type item name…"
                    inputClassName="h-8 text-xs border-border/40"
                  />
                </TableCell>
                <TableCell className="py-1.5 px-1"><Input value={item.hsnCode} onChange={e => updateItem(idx,"hsnCode",e.target.value)} placeholder="HSN" className="h-8 text-xs border-border/40" /></TableCell>
                <TableCell className="py-1.5 px-1"><Input type="number" min={0} value={item.qty} onChange={e => updateItem(idx,"qty",e.target.value)} className="h-8 text-xs text-center border-border/40" /></TableCell>
                <TableCell className="py-1.5 px-1"><Input value={item.unit} onChange={e => updateItem(idx,"unit",e.target.value)} className="h-8 text-xs border-border/40" /></TableCell>
                <TableCell className="py-1.5 px-1"><Input type="number" min={0} value={item.rate} onChange={e => updateItem(idx,"rate",e.target.value)} className="h-8 text-xs text-right border-border/40" /></TableCell>
                {isGst && <TableCell className="py-1.5 px-1"><Input type="number" value={item.gstRate} onChange={e => updateItem(idx,"gstRate",e.target.value)} className="h-8 text-xs text-center border-border/40" /></TableCell>}
                <TableCell className="py-1.5 text-right font-bold text-sm text-primary pr-3">{formatCurrency(item.qty*item.rate)}</TableCell>
                <TableCell className="py-1.5 pl-0">{items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-2.5 border-t border-border/30">
          <Button variant="ghost" size="sm" onClick={addItem} className="gap-1.5 text-primary hover:text-primary h-7 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Line Item
          </Button>
        </div>
      </div>

      {/* Totals + Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 glass-card rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Tag className="w-3 h-3" /> Tax Summary
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{formatCurrency(totals.subtotal)}</span></div>
            {isGst && <>
              <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
            </>}
            <div className="flex justify-between pt-2 border-t border-border/50 mt-2">
              <span className="font-bold">Grand Total</span>
              <span className="text-xl font-black text-primary tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-[200px]">
          <Button
            className="h-12 font-black text-sm gap-2 rounded-xl btn-glow-blue"
            onClick={() => handleSave(type)}
            disabled={type === "Sale" ? createSaleMutation.isPending : createPurchaseMutation.isPending}
          >
            <Save className="w-4 h-4" /> SAVE {type === "Sale" ? "SALE" : "PURCHASE"} INVOICE
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl" onClick={() => printGstInvoice(currentSale(), firm, type)}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-xl" onClick={() => exportGstInvoiceWord(currentSale(), firm, type)}>
              <FileText className="w-3.5 h-3.5" /> Word
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs rounded-xl" onClick={clearForm}>Clear Form</Button>
        </div>
      </div>
    </div>
  );

  const filteredSales = sales.filter(s => !searchTerm || s.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.voucherNo?.includes(searchTerm));
  const filteredPurchases = purchases.filter(p => !searchTerm || p.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.voucherNo?.includes(searchTerm));

  const RegisterTable = ({ rows, type }: { rows: any[]; type: "Sale" | "Purchase" }) => (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 h-9" placeholder="Search by party or voucher no…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Voucher / Invoice No</TableHead>
              <TableHead className="text-xs">Party</TableHead>
              <TableHead className="text-xs">Mode</TableHead>
              <TableHead className="text-xs">GST</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="w-20 text-center text-xs">Print</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => {
              const sv: SaleVoucher = { id: s.id, voucherNo: s.voucherNo, date: s.date, partyName: s.partyName, partyGst: s.partyGst, paymentMode: s.paymentMode, isGstInvoice: s.isGstInvoice, grandTotal: s.grandTotal };
              return (
                <TableRow key={s.id} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="text-xs py-2 text-muted-foreground">{format(new Date(s.date), "dd/MM/yy")}</TableCell>
                  <TableCell className="font-mono text-xs py-2 text-amber-400/80">{s.voucherNo}</TableCell>
                  <TableCell className="py-2">
                    <div className="text-sm font-semibold">{s.partyName}</div>
                    {s.partyGst && <div className="text-[10px] text-muted-foreground">{s.partyGst}</div>}
                  </TableCell>
                  <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{s.paymentMode}</Badge></TableCell>
                  <TableCell className="py-2">
                    {s.isGstInvoice ? <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/25">GST</Badge> : <Badge variant="outline" className="text-[10px]">Simple</Badge>}
                  </TableCell>
                  <TableCell className={cn("text-right font-bold text-sm py-2 tabular-nums", type === "Sale" ? "text-emerald-400" : "text-red-400")}>
                    {formatCurrency(s.grandTotal)}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex gap-1 justify-center">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-400/70 hover:text-blue-400" onClick={() => printGstInvoice(sv, firm, type)}><Printer className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-purple-400/70 hover:text-purple-400" onClick={() => exportGstInvoiceWord(sv, firm, type)}><FileText className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No {type.toLowerCase()} invoices yet.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="p-5 h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mb-4 w-full justify-start border-b border-border/40 rounded-none h-auto bg-transparent p-0 gap-6">
          {[
            { val: "sales-list", label: "Sales Register" },
            { val: "purchases-list", label: "Purchases Register" },
            { val: "new-sale", label: "Sale Invoice" },
            { val: "new-purchase", label: "Purchase Invoice" },
          ].map(tab => (
            <TabsTrigger key={tab.val} value={tab.val} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary transition-colors">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="sales-list" className="flex-1 overflow-auto"><RegisterTable rows={filteredSales} type="Sale" /></TabsContent>
        <TabsContent value="purchases-list" className="flex-1 overflow-auto"><RegisterTable rows={filteredPurchases} type="Purchase" /></TabsContent>
        <TabsContent value="new-sale" className="flex-1 overflow-auto"><InvoiceForm type="Sale" /></TabsContent>
        <TabsContent value="new-purchase" className="flex-1 overflow-auto"><InvoiceForm type="Purchase" /></TabsContent>
      </Tabs>
    </div>
  );
}
