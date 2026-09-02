import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportOrdersPage } from "./pages/ImportOrdersPage";
import { InventoryStockPage } from "./pages/InventoryStockPage";
import { LicensesPage } from "./pages/LicensesPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesOrdersPage } from "./pages/SalesOrdersPage";
import { StockTransactionsPage } from "./pages/StockTransactionsPage";
import { SuppliersPage } from "./pages/SuppliersPage";

const routerBasename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/import-orders" element={<ImportOrdersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/inventory-stocks" element={<InventoryStockPage />} />
            <Route path="/stock-transactions" element={<StockTransactionsPage />} />
            <Route path="/licenses" element={<LicensesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/sales-orders" element={<SalesOrdersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
