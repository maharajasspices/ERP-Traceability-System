import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FMSAuthProvider } from "@/context/FMSAuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { QaViewerGuard } from "@/components/layout/QaViewerGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting - reduces initial bundle size
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

const queryClient = new QueryClient();

// Loading fallback for lazy-loaded routes
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<LandingPage />} />
              <Route element={<ProtectedRoute><QaViewerGuard><MainLayout /></QaViewerGuard></ProtectedRoute>}>
                <Route path="/Dashboard" element={<Dashboard />} />
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