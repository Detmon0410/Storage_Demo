import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { AuditLogPage } from "./pages/AuditLogPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CompanyPage } from "./pages/CompanyPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportOrdersPage } from "./pages/ImportOrdersPage";
import { InventoryStockPage } from "./pages/InventoryStockPage";
import { LicensesPage } from "./pages/LicensesPage";
import { LoginPage } from "./pages/LoginPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesOrdersPage } from "./pages/SalesOrdersPage";
import { StockTransactionsPage } from "./pages/StockTransactionsPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { UsersPage } from "./pages/UsersPage";

const routerBasename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={routerBasename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/import-orders" element={<ImportOrdersPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/inventory-stocks" element={<InventoryStockPage />} />
                <Route path="/stock-transactions" element={<StockTransactionsPage />} />
                <Route path="/company" element={<CompanyPage />} />
                <Route path="/licenses" element={<LicensesPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/sales-orders" element={<SalesOrdersPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
