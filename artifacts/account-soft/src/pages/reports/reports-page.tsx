import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useGetDayBook, useLedgerSearch, useGetMonthlySummary } from "@workspace/api-client-react";
import type { GetDayBookParams, LedgerSearchParams, GetMonthlySummaryParams } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Filter, Calendar, Search, FileSpreadsheet, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  exportDayBookToExcel,
  exportDayBookToPdf,
  exportMonthlySummaryToExcel,
  exportMonthlySummaryToPdf,
} from "@/lib/export";

export default function ReportsPage() {
  const { activeFirm } = useAppContext();
  const [activeTab, setActiveTab] = useState("day-book");

  const [dbFrom, setDbFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dbTo, setDbTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const dbParams: GetDayBookParams = { firmId: activeFirm?.id || 0, dateFrom: dbFrom, dateTo: dbTo };
  const { data: dayBook = [], refetch: refetchDayBook } = useGetDayBook(
    dbParams,
    { query: { queryKey: ['dayBook', dbParams], enabled: activeTab === "day-book" && !!activeFirm } }
  );

  const [lsQuery, setLsQuery] = useState("");
  const lsParams: LedgerSearchParams = { firmId: activeFirm?.id || 0, query: lsQuery };
  const { data: searchResults = [], refetch: refetchSearch } = useLedgerSearch(
    lsParams,
    { query: { queryKey: ['ledgerSearch', lsParams], enabled: activeTab === "ledger-search" && lsQuery.length > 2 && !!activeFirm } }
  );

  const [msFY, setMsFY] = useState(new Date().getFullYear().toString());
  const msParams: GetMonthlySummaryParams = { firmId: activeFirm?.id || 0, financialYear: msFY };
  const { data: monthlySummary } = useGetMonthlySummary(
    msParams,
    { query: { queryKey: ['monthlySummary', msParams], enabled: activeTab === "monthly-summary" && !!activeFirm } }
  );

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const firmName = activeFirm?.name ?? "Firm";

  return (
    <div className="p-6 h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mb-6 w-full justify-start border-b rounded-none h-auto bg-transparent p-0 gap-8">
          <TabsTrigger value="day-book" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Day Book</TabsTrigger>
          <TabsTrigger value="ledger-search" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Ledger Transaction Search</TabsTrigger>
          <TabsTrigger value="monthly-summary" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Monthly Summary</TabsTrigger>
        </TabsList>

        {/* ── Day Book ── */}
        <TabsContent value="day-book" className="flex-1 space-y-6">
          <div className="flex gap-4 items-end bg-card border rounded-lg p-4">
            <div className="space-y-2"><Label>From</Label><Input type="date" value={dbFrom} onChange={e => setDbFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>To</Label><Input type="date" value={dbTo} onChange={e => setDbTo(e.target.value)} /></div>
            <Button onClick={() => refetchDayBook()} className="gap-2"><Filter className="w-4 h-4" /> Load Day Book</Button>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                className="gap-2 border-green-600/40 text-green-400 hover:bg-green-600/10"
                onClick={() => exportDayBookToExcel(dayBook as any, firmName, dbFrom, dbTo)}
                disabled={!dayBook.length}
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-red-600/40 text-red-400 hover:bg-red-600/10"
                onClick={() => exportDayBookToPdf(dayBook as any, firmName, dbFrom, dbTo)}
                disabled={!dayBook.length}
              >
                <FileDown className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>
          <div className="bg-card border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>No</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Particulars</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayBook.map((v, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell>{format(new Date(v.date), "dd/MM/yy")}</TableCell>
                    <TableCell className="font-mono text-[10px] opacity-70">{v.voucherNo}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase">{v.voucherType}</Badge></TableCell>
                    <TableCell className="font-medium">{v.particulars}</TableCell>
                    <TableCell>{v.person}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(v.runningBalance)}</TableCell>
                  </TableRow>
                ))}
                {!dayBook.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No entries found. Adjust the date range and click Load Day Book.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Ledger Transaction Search ── */}
        <TabsContent value="ledger-search" className="flex-1 space-y-6">
          <div className="flex gap-4 items-end bg-card border rounded-lg p-4">
            <div className="space-y-2 flex-1"><Label>Search Transaction (Particulars/Party)</Label><Input value={lsQuery} onChange={e => setLsQuery(e.target.value)} placeholder="Type at least 3 chars..." /></div>
            <Button onClick={() => refetchSearch()} className="gap-2"><Search className="w-4 h-4" /> Search</Button>
          </div>
          <div className="bg-card border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Account Particulars</TableHead>
                  <TableHead>Party/Person</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((v, i) => (
                  <TableRow key={i} className="hover:bg-muted/50">
                    <TableCell>{format(new Date(v.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs font-mono">{v.voucherNo}</TableCell>
                    <TableCell className="font-bold">{v.particulars}</TableCell>
                    <TableCell>{v.person}</TableCell>
                    <TableCell className={cn("text-right font-black", v.voucherType === 'Receipt' ? "text-green-500" : "text-red-500")}>
                      {formatCurrency(v.amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(v.runningBalance)}</TableCell>
                  </TableRow>
                ))}
                {!searchResults.length && lsQuery.length > 2 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No results found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Monthly Summary ── */}
        <TabsContent value="monthly-summary" className="flex-1 space-y-6">
          <div className="flex gap-4 items-end bg-card border rounded-lg p-4">
            <div className="space-y-2"><Label>Financial Year (start year, e.g. 2025)</Label><Input value={msFY} onChange={e => setMsFY(e.target.value)} /></div>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                className="gap-2 border-green-600/40 text-green-400 hover:bg-green-600/10"
                onClick={() => exportMonthlySummaryToExcel(monthlySummary as any ?? {}, firmName, msFY)}
                disabled={!monthlySummary?.rows?.length}
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-red-600/40 text-red-400 hover:bg-red-600/10"
                onClick={() => exportMonthlySummaryToPdf(monthlySummary as any ?? {}, firmName, msFY)}
                disabled={!monthlySummary?.rows?.length}
              >
                <FileDown className="w-4 h-4" /> PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-6">
                <div className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Yearly Total Receipts</div>
                <div className="text-3xl font-black text-green-500">{formatCurrency(monthlySummary?.totalReceipts)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="pt-6">
                <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Yearly Total Payments</div>
                <div className="text-3xl font-black text-red-500">{formatCurrency(monthlySummary?.totalPayments)}</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Net Flow</div>
                <div className="text-3xl font-black text-amber-500">{formatCurrency(monthlySummary?.totalNet)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-card border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Net Flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary?.rows?.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    <TableCell className="font-bold flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {row.month}
                    </TableCell>
                    <TableCell className="text-right text-green-500 font-medium">{formatCurrency(row.receipts)}</TableCell>
                    <TableCell className="text-right text-red-500 font-medium">{formatCurrency(row.payments)}</TableCell>
                    <TableCell className={cn("text-right font-black", row.net < 0 ? "text-red-500" : "text-green-500")}>
                      {formatCurrency(row.net)}
                    </TableCell>
                  </TableRow>
                ))}
                {!monthlySummary?.rows?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No data for financial year {msFY}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
