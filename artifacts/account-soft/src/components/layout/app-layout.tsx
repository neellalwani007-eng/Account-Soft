import React, { useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  Library,
  ShoppingCart,
  BarChart3,
  FileText,
  Settings,
  Upload,
  ChevronDown,
  Zap,
  Users,
  Package,
  AlertCircle,
  Receipt,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppContext } from "@/contexts/app-context";
import { useGetCashBalance } from "@workspace/api-client-react";

const navGroups = [
  {
    label: "Transactions",
    items: [
      { title: "Entry", icon: LayoutDashboard, url: "/", shortcut: "F1–F6" },
      { title: "Cash Book", icon: BookOpen, url: "/cash-book", shortcut: "Alt+C" },
      { title: "Sales & Purchase", icon: ShoppingCart, url: "/sales", shortcut: "Alt+S" },
    ]
  },
  {
    label: "Masters",
    items: [
      { title: "Party Master", icon: Users, url: "/masters/parties", shortcut: "" },
      { title: "Item Master", icon: Package, url: "/masters/items", shortcut: "" },
      { title: "Ledgers", icon: Library, url: "/ledgers", shortcut: "Alt+L" },
    ]
  },
  {
    label: "Reports",
    items: [
      { title: "Analysis", icon: BarChart3, url: "/analysis", shortcut: "Alt+A" },
      { title: "Reports", icon: FileText, url: "/reports", shortcut: "Alt+R" },
      { title: "Outstanding", icon: AlertCircle, url: "/outstanding", shortcut: "" },
      { title: "GST / Trial Balance", icon: Receipt, url: "/gst", shortcut: "" },
    ]
  },
  {
    label: "System",
    items: [
      { title: "Settings", icon: Settings, url: "/settings", shortcut: "Alt+," },
      { title: "Import Excel", icon: Upload, url: "/import", shortcut: "" },
    ]
  }
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { activeFirm, firms, setActiveFirm } = useAppContext();
  const { data: cashBalanceData } = useGetCashBalance(
    { firmId: activeFirm?.id || 0 },
    { query: { enabled: !!activeFirm } }
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'c': setLocation('/cash-book'); break;
          case 'l': setLocation('/ledgers'); break;
          case 's': setLocation('/sales'); break;
          case 'a': setLocation('/analysis'); break;
          case 'r': setLocation('/reports'); break;
          case ',': setLocation('/settings'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  const formatCurrency = (amount: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const balance = cashBalanceData?.balance ?? 0;
  const isNegative = balance < 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar variant="sidebar" collapsible="none" className="border-r border-sidebar-border bg-sidebar w-64 flex flex-col">
          {/* Header */}
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 0 16px rgba(14,165,233,0.4)" }}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-foreground">Account</span>
                <span className="text-base font-black tracking-tight text-primary">Soft</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-sidebar-accent border border-sidebar-border hover:border-primary/40 text-sidebar-foreground transition-all group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.6)" }} />
                    <span className="truncate text-sm font-semibold">{activeFirm?.name || "Select Firm"}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 flex-shrink-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass-card" align="start">
                {firms.map((firm) => (
                  <DropdownMenuItem key={firm.id} onClick={() => setActiveFirm(firm)} className="cursor-pointer">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2" />
                    {firm.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="flex-1 overflow-y-auto py-2">
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="px-4 py-1.5 text-[10px] font-bold text-sidebar-foreground/35 uppercase tracking-widest">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link
                              href={item.url}
                              className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-xl transition-all text-sm ${
                                isActive
                                  ? "sidebar-active-item font-semibold"
                                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                              }`}
                            >
                              <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                              <span className="flex-1 truncate">{item.title}</span>
                              {item.shortcut && (
                                <span className="text-[9px] font-mono opacity-30 group-hover:opacity-60">
                                  {item.shortcut}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          {/* Footer — Cash Balance */}
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="rounded-xl p-3 bg-gradient-to-br from-sidebar-accent to-sidebar-accent/40 border border-sidebar-border">
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold mb-1">
                Cash Balance
              </div>
              <div className={`text-xl font-black tabular-nums ${isNegative ? "text-red-400" : "text-emerald-400"}`}
                style={{ textShadow: isNegative ? "0 0 12px rgba(248,113,113,0.4)" : "0 0 12px rgba(52,211,153,0.4)" }}>
                {formatCurrency(balance)}
              </div>
              <div className="text-[10px] text-sidebar-foreground/30 mt-0.5 truncate">
                {activeFirm?.name || "No firm selected"}
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-background">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
