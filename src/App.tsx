import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Requirements = lazy(() => import("@/pages/Requirements"));
const RequirementDetail = lazy(() => import("@/pages/RequirementDetail"));
const NewRequirement = lazy(() => import("@/pages/NewRequirement"));
const LeadershipDashboard = lazy(() => import("@/pages/LeadershipDashboard"));
const DesignathonManagement = lazy(() => import("@/pages/DesignathonManagement"));
const ProductionCatalogue = lazy(() => import("@/pages/ProductionCatalogue"));
const DeviceDocumentation = lazy(() => import("@/pages/DeviceDocumentation"));
const MonthlyReport = lazy(() => import("@/pages/MonthlyReport"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
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
      <HashRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/requirements" element={<ProtectedRoute><AppLayout><Requirements /></AppLayout></ProtectedRoute>} />
              <Route path="/requirements/new" element={<ProtectedRoute><AppLayout><NewRequirement /></AppLayout></ProtectedRoute>} />
              <Route path="/requirements/:id" element={<ProtectedRoute><AppLayout><RequirementDetail /></AppLayout></ProtectedRoute>} />
              <Route path="/requirements/:id/documentation" element={<ProtectedRoute><AppLayout><DeviceDocumentation /></AppLayout></ProtectedRoute>} />
              <Route path="/catalogue" element={<ProtectedRoute><AppLayout><ProductionCatalogue /></AppLayout></ProtectedRoute>} />
              <Route path="/designathon" element={<ProtectedRoute><AppLayout><DesignathonManagement /></AppLayout></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AppLayout><LeadershipDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><AppLayout><MonthlyReport /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AppLayout><UserManagement /></AppLayout></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
