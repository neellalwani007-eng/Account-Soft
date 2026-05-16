import React, { useState } from "react";
import { useAppContext } from "@/contexts/app-context";
import { useGetAnalysis } from "@workspace/api-client-react";
import type { GetAnalysisParams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from "recharts";
import { ArrowDownRight, TrendingUp, Receipt, Activity, FileDown, FileText } from "lucide-react";

export default function AnalysisPage() {
  const { activeFirm } = useAppContext();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const params: GetAnalysisParams = { firmId: activeFirm?.id || 0, dateFrom, dateTo };
  const { data: analysis } = useGetAnalysis(
    params,
    { query: { queryKey: ['analysis', params], enabled: !!activeFirm } }
  );

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const COLORS = ['#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6'];

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-end bg-card border rounded-lg p-4">
        <div className="flex gap-4 items-end">
          <div className="space-y-2">
            <Label>Date From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button>Update View</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><FileText className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" className="gap-2"><FileDown className="w-4 h-4" /> PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-t-4 border-t-green-500 hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
              Total Receipts <Receipt className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-500">{formatCurrency(analysis?.totalReceipts)}</div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-red-500 hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
              Total Payments <ArrowDownRight className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-500">{formatCurrency(analysis?.totalPayments)}</div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-amber-500 hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
              Net Cash Flow <TrendingUp className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${(analysis?.netCashFlow || 0) < 0 ? 'text-red-500' : 'text-amber-500'}`}>
              {formatCurrency(analysis?.netCashFlow)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-purple-500 hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
              Transactions <Activity className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-500">{analysis?.transactionCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle className="text-lg">Daily Cash Flow</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.dailyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip contentStyle={{backgroundColor: '#111', border: '1px solid #333'}} />
                <Legend />
                <Bar dataKey="receipts" fill="#10B981" name="Receipts" />
                <Bar dataKey="payments" fill="#EF4444" name="Payments" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payment Mode Breakdown</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis?.modeBreakdown}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="amount"
                >
                  {analysis?.modeBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Top Party Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-bold text-green-500 mb-2 uppercase tracking-wider">Top Receipt Parties</div>
              <div className="space-y-3">
                {analysis?.topReceiptParties.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{p.name}</span>
                      <span className="font-bold">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-green-500 h-full" style={{ width: `${(p.amount / (analysis?.totalReceipts || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-red-500 mb-2 uppercase tracking-wider">Top Payment Parties</div>
              <div className="space-y-3">
                {analysis?.topPaymentParties.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{p.name}</span>
                      <span className="font-bold">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-red-500 h-full" style={{ width: `${(p.amount / (analysis?.totalPayments || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Firm Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Firm Name</th>
                    <th className="text-right p-3">Receipts</th>
                    <th className="text-right p-3">Payments</th>
                    <th className="text-right p-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analysis?.firmComparisons.map((f, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      <td className="p-3 font-medium">{f.firmName}</td>
                      <td className="p-3 text-right text-green-500">{formatCurrency(f.receipts)}</td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(f.payments)}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(f.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
