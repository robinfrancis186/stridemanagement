import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/requirements" element={<ProtectedRoute><Requirements /></ProtectedRoute>} />
            <Route path="/requirements/new" element={<ProtectedRoute><NewRequirement /></ProtectedRoute>} />
            <Route path="/requirements/:id" element={<ProtectedRoute><RequirementDetail /></ProtectedRoute>} />
            <Route path="/requirements/:id/documentation" element={<ProtectedRoute><DeviceDocumentation /></ProtectedRoute>} />
            <Route path="/catalogue" element={<ProtectedRoute><ProductionCatalogue /></ProtectedRoute>} />
            <Route path="/designathon" element={<ProtectedRoute><DesignathonManagement /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><LeadershipDashboard /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
