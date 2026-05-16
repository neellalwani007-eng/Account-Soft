import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useGetCashBook } from "@workspace/api-client-react";
import type { GetCashBookParams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth } from "date-fns";
import { FileDown, FileSpreadsheet, Filter, Calendar } from "lucide-react";
import { exportCashBookToExcel, exportCashBookToPdf } from "@/lib/export";

export default function CashBookPage() {
  const { activeFirm } = useAppContext();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const params: GetCashBookParams = { firmId: activeFirm?.id || 0, dateFrom, dateTo };
  const { data: cashBook, refetch } = useGetCashBook(
    params,
    { query: { queryKey: ['cashBook', params], enabled: !!activeFirm } }
  );

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const handleExcel = () => {
    if (!cashBook) return;
    exportCashBookToExcel(cashBook, activeFirm?.name ?? "Firm", dateFrom, dateTo);
  };

  const handlePdf = () => {
    if (!cashBook) return;
    exportCashBookToPdf(cashBook, activeFirm?.name ?? "Firm", dateFrom, dateTo);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-end gap-4 bg-card border rounded-lg p-4">
        <div className="space-y-2 flex-1">
          <Label>From Date</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2 flex-1">
          <Label>To Date</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button onClick={() => refetch()} className="gap-2">
          <Filter className="w-4 h-4" /> Apply Filter
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 border-green-600/40 text-green-400 hover:bg-green-600/10"
            onClick={handleExcel}
            disabled={!cashBook?.days?.length}
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-red-600/40 text-red-400 hover:bg-red-600/10"
            onClick={handlePdf}
            disabled={!cashBook?.days?.length}
          >
            <FileDown className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {cashBook?.days.map((day) => (
          <div key={day.date} className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted p-3 flex justify-between items-center border-b">
              <div className="flex items-center gap-2 font-bold">
                <Calendar className="w-4 h-4" />
                {format(new Date(day.date), "EEEE, dd MMMM yyyy")}
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-muted-foreground">Opening: <b className="text-blue-500">{formatCurrency(day.openingBalance)}</b></span>
                <span className="text-muted-foreground">Closing: <b className={day.closingBalance < 0 ? "text-destructive" : "text-green-500"}>{formatCurrency(day.closingBalance)}</b></span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-r">
                <div className="bg-green-500/10 p-2 text-center text-xs font-bold text-green-500 border-b">
                  DR — RECEIPTS
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Particulars</TableHead>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-blue-500/5 italic text-xs">
                      <TableCell>Opening Balance</TableCell>
                      <TableCell className="text-right">{formatCurrency(day.openingBalance)}</TableCell>
                    </TableRow>
                    {day.receipts.map((entry, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell>
                          <div className="font-medium">{entry.particulars}</div>
                          <div className="text-[10px] opacity-60">{entry.person}</div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-500">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <div className="bg-red-500/10 p-2 text-center text-xs font-bold text-red-500 border-b">
                  CR — PAYMENTS
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Particulars</TableHead>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {day.payments.map((entry, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell>
                          <div className="font-medium">{entry.particulars}</div>
                          <div className="text-[10px] opacity-60">{entry.person}</div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-500">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-green-500/5 italic text-xs">
                      <TableCell>Closing Balance</TableCell>
                      <TableCell className="text-right">{formatCurrency(day.closingBalance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="bg-muted/30 p-3 grid grid-cols-2 text-sm font-bold border-t">
              <div className="text-right pr-4">Total: {formatCurrency(day.openingBalance + day.receipts.reduce((acc, r) => acc + r.amount, 0))}</div>
              <div className="text-right pr-4">Total: {formatCurrency(day.closingBalance + day.payments.reduce((acc, p) => acc + p.amount, 0))}</div>
            </div>
          </div>
        ))}
        {!cashBook?.days.length && (
          <div className="text-center py-20 border-2 border-dashed rounded-lg text-muted-foreground">
            No transactions found for the selected period.
          </div>
        )}
      </div>

      <div className="fixed bottom-6 right-6 left-72 bg-card border-t border-x shadow-2xl p-4 flex justify-around rounded-t-xl z-10">
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase font-bold">Total Receipts</div>
          <div className="text-xl font-bold text-green-500">{formatCurrency(cashBook?.totalReceipts)}</div>
        </div>
        <div className="text-center border-x px-8">
          <div className="text-xs text-muted-foreground uppercase font-bold">Total Payments</div>
          <div className="text-xl font-bold text-red-500">{formatCurrency(cashBook?.totalPayments)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase font-bold">Net Period Flow</div>
          <div className="text-xl font-bold text-amber-500">{formatCurrency(cashBook?.netFlow)}</div>
        </div>
      </div>
      <div className="h-20" />
    </div>
  );
}
