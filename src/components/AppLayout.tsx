import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Plus,
  User,
  BarChart3,
  Trophy,
  Package,
  Calendar,
} from "lucide-react";
import strideLogo from "@/assets/stride-logo.png";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import ConnectivityBanner from "@/components/ConnectivityBanner";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/requirements", icon: ListChecks, label: "Requirements" },
  { to: "/requirements/new", icon: Plus, label: "New Requirement" },
  { to: "/catalogue", icon: Package, label: "Catalogue" },
  { to: "/designathon", icon: Trophy, label: "Designathon" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/reports", icon: Calendar, label: "Monthly Report" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
            <img src={strideLogo} alt="STRIDE Logo" className="h-9 w-9 object-contain" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-base font-bold text-sidebar-foreground">STRIDE COE</h1>
            <p className="text-[11px] text-sidebar-foreground/60">Workflow Management</p>
          </div>
          <NotificationBell />
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
              <User className="h-4 w-4 text-sidebar-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                Demo User
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                COE ADMIN
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64 flex-1 flex flex-col">
        <ConnectivityBanner />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
