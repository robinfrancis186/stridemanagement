import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Requirements from "@/pages/Requirements";
import RequirementDetail from "@/pages/RequirementDetail";
import NewRequirement from "@/pages/NewRequirement";
import LeadershipDashboard from "@/pages/LeadershipDashboard";
import DesignathonManagement from "@/pages/DesignathonManagement";
import ProductionCatalogue from "@/pages/ProductionCatalogue";
import DeviceDocumentation from "@/pages/DeviceDocumentation";
import MonthlyReport from "@/pages/MonthlyReport";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
