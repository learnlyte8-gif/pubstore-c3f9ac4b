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
import StoreActions from "./pages/StoreActions.tsx";
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
import News from "./pages/News.tsx";
import Stays from "./pages/Stays.tsx";
import Auto from "./pages/Auto.tsx";
import Industrial from "./pages/Industrial.tsx";
import Agro from "./pages/Agro.tsx";
import Rides from "./pages/Rides.tsx";
import Driver from "./pages/Driver.tsx";
import Services from "./pages/Services.tsx";
import Properties from "./pages/Properties.tsx";
import Logistics from "./pages/Logistics.tsx";
import Finance from "./pages/Finance.tsx";
import Jobs from "./pages/Jobs.tsx";
import JobsProfile from "./pages/JobsProfile.tsx";
import JobsNetwork from "./pages/JobsNetwork.tsx";
import JobsFeed from "./pages/JobsFeed.tsx";
import CarRentals from "./pages/CarRentals.tsx";
import UserProfile from "./pages/UserProfile.tsx";
import GroupBuyDetail from "./pages/GroupBuyDetail.tsx";
import PayAction from "./pages/PayAction.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep cached data fresh for 60s and in memory for 5min so navigating
      // between pages doesn't reset every screen to a "Loading…" state.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ShopProvider>
        <ImportJobProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner
            position="top-center"
            richColors={false}
            closeButton={false}
            expand={false}
            visibleToasts={3}
            offset={`calc(env(safe-area-inset-top) + 10px)`}
            mobileOffset={`calc(env(safe-area-inset-top) + 10px)`}
            gap={8}
            toastOptions={{
              duration: 3800,
              unstyled: false,
              classNames: {
                toast:
                  "group toast !rounded-2xl !border !border-border/60 !bg-background/92 !backdrop-blur-2xl !text-foreground !shadow-[0_18px_40px_-12px_hsl(0_0%_0%/0.35)] !px-3.5 !py-3 !gap-3 animate-in slide-in-from-top-3 fade-in duration-300",
                title: "!text-[14px] !font-semibold !leading-tight !tracking-tight",
                description: "!text-[12.5px] !text-muted-foreground !leading-snug",
                actionButton:
                  "!bg-primary !text-primary-foreground !rounded-full !px-3 !py-1.5 !text-xs !font-bold",
                cancelButton:
                  "!bg-muted !text-muted-foreground !rounded-full !px-3 !py-1.5 !text-xs",
                closeButton:
                  "!bg-background !border-border/60 !text-muted-foreground hover:!text-foreground",
              },
            }}
          />
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
                <Route path="/store/actions" element={<StoreActions />} />
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
                <Route path="/news" element={<News />} />
                <Route path="/news/:slug" element={<News />} />
                <Route path="/stays" element={<Stays />} />
                <Route path="/stays/:id" element={<Stays />} />
                <Route path="/auto" element={<Auto />} />
                <Route path="/auto/:id" element={<Auto />} />
                <Route path="/industrial" element={<Industrial />} />
                <Route path="/industrial/:id" element={<Industrial />} />
                <Route path="/agro" element={<Agro />} />
                <Route path="/agro/:id" element={<Agro />} />
                <Route path="/rides" element={<Rides />} />
                <Route path="/rides/:id" element={<Rides />} />
                <Route path="/driver" element={<Driver />} />
                <Route path="/services" element={<Services />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/logistics" element={<Logistics />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/feed" element={<JobsFeed />} />
                <Route path="/jobs/network" element={<JobsNetwork />} />
                <Route path="/jobs/me" element={<JobsProfile />} />
                <Route path="/jobs/people/:userId" element={<JobsProfile />} />
                <Route path="/jobs/:id" element={<Jobs />} />
                <Route path="/car-rentals" element={<CarRentals />} />
                <Route path="/car-rentals/:id" element={<CarRentals />} />
                <Route path="/u/:userId" element={<UserProfile />} />
                <Route path="/group-buy/:id" element={<GroupBuyDetail />} />
                <Route path="/pay/:kind/:id" element={<PayAction />} />
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
