import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Requirements = lazy(() => import("@/pages/Requirements"));
const RequirementDetail = lazy(() => import("@/pages/RequirementDetail"));
const NewRequirement = lazy(() => import("@/pages/NewRequirement"));
const LeadershipDashboard = lazy(() => import("@/pages/LeadershipDashboard"));
const DesignathonManagement = lazy(() => import("@/pages/DesignathonManagement"));
const ProductionCatalogue = lazy(() => import("@/pages/ProductionCatalogue"));
const DeviceDocumentation = lazy(() => import("@/pages/DeviceDocumentation"));
const MonthlyReport = lazy(() => import("@/pages/MonthlyReport"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/requirements" element={<AppLayout><Requirements /></AppLayout>} />
              <Route path="/requirements/new" element={<AppLayout><NewRequirement /></AppLayout>} />
              <Route path="/requirements/:id" element={<AppLayout><RequirementDetail /></AppLayout>} />
              <Route path="/requirements/:id/documentation" element={<AppLayout><DeviceDocumentation /></AppLayout>} />
              <Route path="/catalogue" element={<AppLayout><ProductionCatalogue /></AppLayout>} />
              <Route path="/designathon" element={<AppLayout><DesignathonManagement /></AppLayout>} />
              <Route path="/analytics" element={<AppLayout><LeadershipDashboard /></AppLayout>} />
              <Route path="/reports" element={<AppLayout><MonthlyReport /></AppLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
