import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { UserProvider } from './context/UserContext.jsx';
import ProtectedRoute from './shared/components/ProtectedRoute.jsx';
import BackofficeLayout from './layouts/backoffice/BackofficeLayout.jsx';
import FrontofficeLayout from './modules/frontoffice/FrontofficeLayout.jsx';

import LoginPage from './modules/backoffice/components/LoginPage.jsx';
import DashboardPage from './modules/backoffice/components/DashboardPage.jsx';
import ImportPage from './modules/backoffice/components/ImportPage.jsx';
import ResetDataPage from './modules/backoffice/components/ResetDataPage.jsx';
import OrdersManagePage from './modules/backoffice/components/OrdersManagePage.jsx';
import StockAddPage from './modules/backoffice/components/StockAddPage.jsx';
import StockHistoryPage from './modules/backoffice/components/StockHistoryPage.jsx';
import CartListPage from './modules/backoffice/components/CartListPage.jsx';
import StatsPage from './modules/backoffice/components/StatsPage.jsx';

import UserSelectPage from './modules/frontoffice/components/UserSelectPage.jsx';
import ProductListPage from './modules/frontoffice/components/ProductListPage.jsx';
import ProductDetailPage from './modules/frontoffice/components/ProductDetailPage.jsx';
import CartPage from './modules/frontoffice/components/CartPage.jsx';
import CheckoutPage from './modules/frontoffice/components/CheckoutPage.jsx';
import MyOrdersPage from './modules/frontoffice/components/MyOrdersPage.jsx';
import OrderValidationPage from './modules/frontoffice/components/OrderValidationPage.jsx';
import SearchPage from './modules/frontoffice/components/SearchPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserProvider>
          <CartProvider>
            <Routes>
              {/* Backoffice */}
              <Route path="/admin/login" element={<LoginPage />} />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute>
                    <BackofficeLayout>
                      <Routes>
                        <Route path="dashboard"    element={<DashboardPage />} />
                        <Route path="import"       element={<ImportPage />} />
                        <Route path="reset"        element={<ResetDataPage />} />
                        <Route path="orders"       element={<OrdersManagePage />} />
                        <Route path="stock"        element={<StockAddPage />} />
                        <Route path="stock/history" element={<StockHistoryPage />} />
                        <Route path="carts"        element={<CartListPage />} />
                        <Route path="stats"        element={<StatsPage />} />
                        <Route index element={<Navigate to="dashboard" replace />} />
                      </Routes>
                    </BackofficeLayout>
                  </ProtectedRoute>
                }
              />

              {/* Frontoffice */}
              <Route path="/" element={<UserSelectPage />} />
              <Route
                path="/*"
                element={
                  <FrontofficeLayout>
                    <Routes>
                      <Route path="products"      element={<ProductListPage />} />
                      <Route path="product/:id"   element={<ProductDetailPage />} />
                      <Route path="cart"          element={<CartPage />} />
                      <Route path="checkout"      element={<CheckoutPage />} />
                      <Route path="my-orders"     element={<MyOrdersPage />} />
                      <Route path="my-orders/:id" element={<OrderValidationPage />} />
                      <Route path="search"        element={<SearchPage />} />
                      <Route path="*"             element={<Navigate to="/products" replace />} />
                    </Routes>
                  </FrontofficeLayout>
                }
              />
            </Routes>
          </CartProvider>
        </UserProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
