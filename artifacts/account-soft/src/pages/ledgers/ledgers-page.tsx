import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useGetLedgerEntries, useListLedgers } from "@workspace/api-client-react";
import type { ListLedgersParams, GetLedgerEntriesParams, LedgerEntry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfYear } from "date-fns";
import { Search, FileText, FileDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function LedgersPage() {
  const { activeFirm } = useAppContext();
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);

  const listParams: ListLedgersParams = { firmId: activeFirm?.id || 0 };
  const { data: ledgers = [] } = useListLedgers(
    listParams,
    { query: { queryKey: ['ledgers', listParams], enabled: !!activeFirm } }
  );

  const entryParams: GetLedgerEntriesParams = { 
    firmId: activeFirm?.id || 0, 
    ledgerName: selectedLedger || "",
    dateFrom,
    dateTo
  };
  const { data: tFormData, refetch } = useGetLedgerEntries(
    entryParams,
    { query: { queryKey: ['ledgerEntries', entryParams], enabled: !!activeFirm && !!selectedLedger } }
  );

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const debits = tFormData?.entries.filter(e => e.side === 'Dr') || [];
  const credits = tFormData?.entries.filter(e => e.side === 'Cr') || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-end gap-4 bg-card border rounded-lg p-4">
        <div className="space-y-2 flex-[2]">
          <Label>Account Ledger</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {selectedLedger || "Select Ledger..."}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search ledger..." />
                <CommandList>
                  <CommandEmpty>No ledger found.</CommandEmpty>
                  <CommandGroup>
                    {ledgers.map((l) => (
                      <CommandItem
                        key={l.id}
                        onSelect={() => {
                          setSelectedLedger(l.name);
                          setOpen(false);
                        }}
                      >
                        {l.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 flex-1">
          <Label>From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2 flex-1">
          <Label>To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button onClick={() => refetch()} disabled={!selectedLedger}>Load</Button>
      </div>

      {tFormData ? (
        <div className="space-y-6">
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="bg-muted p-4 flex justify-between items-center border-b">
              <h2 className="text-xl font-bold uppercase tracking-wide">{selectedLedger}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1"><FileText className="w-4 h-4" /> Excel</Button>
                <Button variant="outline" size="sm" className="gap-1"><FileDown className="w-4 h-4" /> PDF</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-x border-b">
              <div>
                <div className="bg-red-500/10 p-2 text-center text-xs font-bold text-red-500 border-b">DR SIDE (DEBIT)</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-20">Date</TableHead>
                      <TableHead className="text-[10px]">Particulars</TableHead>
                      <TableHead className="text-right text-[10px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="italic text-xs text-blue-500 bg-blue-500/5">
                      <TableCell colSpan={2}>Opening Balance</TableCell>
                      <TableCell className="text-right">{formatCurrency(tFormData.openingBalance)}</TableCell>
                    </TableRow>
                    {debits.map((entry, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell>{format(new Date(entry.date), "dd/MM")}</TableCell>
                        <TableCell>{entry.contraAccount}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <div className="bg-green-500/10 p-2 text-center text-xs font-bold text-green-500 border-b">CR SIDE (CREDIT)</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-20">Date</TableHead>
                      <TableHead className="text-[10px]">Particulars</TableHead>
                      <TableHead className="text-right text-[10px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credits.map((entry, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell>{format(new Date(entry.date), "dd/MM")}</TableCell>
                        <TableCell>{entry.contraAccount}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 bg-muted/30 font-bold p-3">
              <div className="text-right pr-4">Total: {formatCurrency(tFormData.totalDr)}</div>
              <div className="text-right pr-4">Total: {formatCurrency(tFormData.totalCr)}</div>
            </div>
          </div>

          <div className="flex justify-end p-6 bg-card border rounded-lg">
            <div className="text-right">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Closing Balance</div>
              <div className={cn(
                "text-3xl font-black",
                tFormData.closingBalanceSide === 'Dr' ? "text-red-500" : "text-green-500"
              )}>
                {formatCurrency(tFormData.closingBalance)} {tFormData.closingBalanceSide}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-40 border-2 border-dashed rounded-lg text-muted-foreground">
          {selectedLedger ? "Loading ledger data..." : "Search and select a ledger account to view T-Form entries."}
        </div>
      )}
    </div>
  );
}
