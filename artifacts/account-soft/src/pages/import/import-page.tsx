import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useImportExcel } from "@workspace/api-client-react";
import type { ImportExcelBody, ImportRow } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Download, CheckCircle2, FileWarning } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export default function ImportPage() {
  const { activeFirm } = useAppContext();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ inserted: number; skipped: number } | null>(null);

  const importMutation = useImportExcel();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file || !activeFirm) return;

    setIsImporting(true);
    setProgress(10);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames.includes("DB") ? "DB" : workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        setProgress(40);

        const importRows: ImportRow[] = rows.map((r: any) => ({
          timestamp: r.Timestamp || new Date().toISOString(),
          username: r.Username || "admin",
          firm: r.Firm || activeFirm.name,
          date: r.Date || format(new Date(), "yyyy-MM-dd"),
          voucherNo: r.VoucherNo?.toString() || "",
          voucherType: r.Type || "Receipt",
          particulars: r.Particulars || "",
          person: r.Person || "",
          amount: parseFloat(r.Amount) || 0,
        }));

        setProgress(70);

        const importBody: ImportExcelBody = { firmId: activeFirm.id, rows: importRows };
        const res = await importMutation.mutateAsync({ data: importBody });
        setResults({ inserted: res.inserted, skipped: res.skipped });
        setProgress(100);
        setIsImporting(false);
        toast({ title: "Import Complete", description: `Successfully imported ${res.inserted} entries.` });
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setIsImporting(false);
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Bulk Import Data</h1>
          <p className="text-muted-foreground">Import transactions from legacy Excel workbooks</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Sample Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Select Spreadsheet</CardTitle>
            <CardDescription>Upload .xlsx or .xlsm files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col items-center justify-center py-10 border rounded-lg bg-card">
               <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
               <input 
                 type="file" 
                 id="excel-upload" 
                 className="hidden" 
                 accept=".xlsx, .xlsm" 
                 onChange={handleFileChange} 
               />
               <label htmlFor="excel-upload" className="cursor-pointer">
                 <Button variant="secondary" asChild>
                   <span>{file ? file.name : "Choose File"}</span>
                 </Button>
               </label>
             </div>
             <Button className="w-full h-12 font-bold" disabled={!file || isImporting} onClick={handleImport}>
               {isImporting ? "Processing..." : "START IMPORT"}
             </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>1. Ensure your Excel file has a sheet named <b className="text-foreground">"DB"</b>.</p>
            <p>2. Column headers must include: <code className="bg-muted px-1 rounded">Date, VoucherNo, Type, Particulars, Person, Amount</code>.</p>
            <p>3. Dates should be in <code className="bg-muted px-1 rounded">YYYY-MM-DD</code> or Excel date format.</p>
            <p>4. Types supported: <code className="bg-muted px-1 rounded">Receipt, Payment, Bank, Journal</code>.</p>
            <p>5. Duplicates (same Date, No, and Amount) will be automatically skipped.</p>
          </CardContent>
        </Card>
      </div>

      {isImporting && (
        <Card className="bg-card shadow-2xl">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm font-bold">
              <span>Importing Vouchers...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="pt-6 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-xs font-bold uppercase opacity-60">Successfully Inserted</div>
                <div className="text-2xl font-black text-green-500">{results.inserted}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="pt-6 flex items-center gap-4">
              <FileWarning className="w-8 h-8 text-amber-500" />
              <div>
                <div className="text-xs font-bold uppercase opacity-60">Skipped (Duplicates)</div>
                <div className="text-2xl font-black text-amber-500">{results.skipped}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
