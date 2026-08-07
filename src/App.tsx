import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FMSAuthProvider } from "@/context/FMSAuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { QaViewerGuard } from "@/components/layout/QaViewerGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import StockCodes from "./pages/StockCodes";
import ReceivingLog from "./pages/ReceivingLog";
import BillOfMaterials from "./pages/BillOfMaterials";
import BatchSheet from "./pages/BatchSheet";
import Dispatch from "./pages/Dispatch";
import Traceability from "./pages/Traceability";
import Suppliers from "./pages/Suppliers";
import Settings from "./pages/Settings";
// import Invoices from "./pages/Invoices";

import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FMSAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><QaViewerGuard><MainLayout /></QaViewerGuard></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock-codes" element={<StockCodes />} />
              <Route path="/receiving" element={<ReceivingLog />} />
              <Route path="/bom" element={<BillOfMaterials />} />
              <Route path="/batch-sheet" element={<BatchSheet />} />
              <Route path="/dispatch" element={<Dispatch />} />
              <Route path="/traceability" element={<Traceability />} />
              <Route path="/suppliers" element={<Suppliers />} />
              {/* <Route path="/invoices" element={<Invoices />} /> */}
              <Route path="/settings" element={<Settings />} />
              
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </FMSAuthProvider>
  </QueryClientProvider>
);

export default App;
