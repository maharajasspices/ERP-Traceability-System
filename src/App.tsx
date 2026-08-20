import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FMSAuthProvider, useFMSAuth } from "@/context/FMSAuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { QaViewerGuard } from "@/components/layout/QaViewerGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import { HRLayout } from "@/components/layout/HRLayout";
import { Loader2, ShieldX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const StockCodes = lazy(() => import("./pages/StockCodes"));
const ReceivingLog = lazy(() => import("./pages/ReceivingLog"));
const BillOfMaterials = lazy(() => import("./pages/BillOfMaterials"));
const BatchSheet = lazy(() => import("./pages/BatchSheet"));
const Dispatch = lazy(() => import("./pages/Dispatch"));
const Traceability = lazy(() => import("./pages/Traceability"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminPasswords = lazy(() => import("./pages/AdminPasswords"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const HRDashboard = lazy(() => import("./pages/HR/HRDashboard"));
const HRLogin = lazy(() => import("./pages/HR/HRLogin"));
const Employees = lazy(() => import("./pages/HR/Employees"));
const Attendance = lazy(() => import("./pages/HR/Attendance"));
const Leave = lazy(() => import("./pages/HR/Leave"));
const Documents = lazy(() => import("./pages/HR/Documents"));
const Warnings = lazy(() => import("./pages/HR/Warnings"));

const queryClient = new QueryClient();

const HRRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, fmsUser, loading, signOut } = useFMSAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/hr-login" replace />;
  }

  if (!fmsUser || (fmsUser.role !== 'hr_user' && fmsUser.role !== 'system_admin')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">HR Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            Only authorized HR staff can access the HR dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={signOut} variant="outline">Sign Out</Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Back to Portal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FMSAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/hr-login" element={<HRLogin />} />
              <Route element={<HRRouteGuard><HRLayout /></HRRouteGuard>}>
                <Route path="/hr-dashboard" element={<HRDashboard />} />
                <Route path="/hr/employees" element={<Employees />} />
                <Route path="/hr/attendance" element={<Attendance />} />
                <Route path="/hr/leave" element={<Leave />} />
                <Route path="/hr/documents" element={<Documents />} />
                <Route path="/hr/warnings" element={<Warnings />} />
              </Route>

              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<LandingPage />} />
              <Route element={<ProtectedRoute><QaViewerGuard><MainLayout /></QaViewerGuard></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stock-codes" element={<StockCodes />} />
                <Route path="/receiving" element={<ReceivingLog />} />
                <Route path="/bom" element={<BillOfMaterials />} />
                <Route path="/batch-sheet" element={<BatchSheet />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/traceability" element={<Traceability />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin-passwords" element={<AdminPasswords />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </FMSAuthProvider>
  </QueryClientProvider>
);

export default App;