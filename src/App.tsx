import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShopProvider } from "@/store/shop";
import { ImportJobProvider } from "@/store/importJob";
import Splash from "./pages/Splash.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import AppShell from "./components/AppShell.tsx";
import Home from "./pages/Home.tsx";
import Cart from "./pages/Cart.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Search from "./pages/Search.tsx";
import Categories from "./pages/Categories.tsx";
import Wishlist from "./pages/Wishlist.tsx";
import Messages from "./pages/Messages.tsx";
import Account from "./pages/Account.tsx";
import Supplier from "./pages/Supplier.tsx";
import Orders from "./pages/Orders.tsx";
import RFQ from "./pages/RFQ.tsx";
import Notifications from "./pages/Notifications.tsx";
import Compare from "./pages/Compare.tsx";
import Live from "./pages/Live.tsx";
import MyStore from "./pages/MyStore.tsx";
import StoreSection from "./pages/StoreSection.tsx";
import Addresses from "./pages/Addresses.tsx";
import PaymentMethods from "./pages/PaymentMethods.tsx";
import BecomeSupplier from "./pages/BecomeSupplier.tsx";
import HelpCenter from "./pages/HelpCenter.tsx";
import Privacy from "./pages/Privacy.tsx";
import Settings from "./pages/Settings.tsx";
import NotificationPreferences from "./pages/NotificationPreferences.tsx";
import Placeholder from "./pages/Placeholder.tsx";
import Wallet from "./pages/Wallet.tsx";
import Verification from "./pages/Verification.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ShopProvider>
        <ImportJobProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<AppShell />}>
                <Route path="/home" element={<Home />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={<Search />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/rfq" element={<RFQ />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/live" element={<Live />} />
                <Route path="/live/:id" element={<Live />} />
                <Route path="/supplier/:id" element={<Supplier />} />
                <Route path="/profile" element={<Account />} />
                <Route path="/account" element={<Account />} />
                <Route path="/store" element={<MyStore />} />
                <Route path="/store/:section" element={<StoreSection />} />
                <Route path="/store/:section/:sub" element={<StoreSection />} />
                <Route path="/addresses" element={<Addresses />} />
                <Route path="/payment-methods" element={<PaymentMethods />} />
                <Route path="/become-supplier" element={<BecomeSupplier />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/notifications" element={<NotificationPreferences />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/verification" element={<Verification />} />
              </Route>
              <Route path="/index" element={<Navigate to="/home" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ImportJobProvider>
      </ShopProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
