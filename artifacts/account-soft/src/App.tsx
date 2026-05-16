import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/app-context";
import { AppLayout } from "@/components/layout/app-layout";
import EntryPage from "@/pages/entry/entry-page";
import CashBookPage from "@/pages/cash-book/cash-book-page";
import LedgersPage from "@/pages/ledgers/ledgers-page";
import SalesPage from "@/pages/sales/sales-page";
import AnalysisPage from "@/pages/analysis/analysis-page";
import ReportsPage from "@/pages/reports/reports-page";
import SettingsPage from "@/pages/settings/settings-page";
import ImportPage from "@/pages/import/import-page";
import PartiesPage from "@/pages/masters/parties-page";
import ItemsPage from "@/pages/masters/items-page";
import OutstandingPage from "@/pages/outstanding/outstanding-page";
import GstPage from "@/pages/gst/gst-page";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={EntryPage} />
        <Route path="/cash-book" component={CashBookPage} />
        <Route path="/ledgers" component={LedgersPage} />
        <Route path="/sales" component={SalesPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/masters/parties" component={PartiesPage} />
        <Route path="/masters/items" component={ItemsPage} />
        <Route path="/outstanding" component={OutstandingPage} />
        <Route path="/gst" component={GstPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
