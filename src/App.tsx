import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShopProvider } from "@/store/shop";
import Splash from "./pages/Splash.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import AppShell from "./components/AppShell.tsx";
import Home from "./pages/Home.tsx";
import Cart from "./pages/Cart.tsx";
import Placeholder from "./pages/Placeholder.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <ShopProvider>
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
                <Route path="/search" element={<Placeholder title="Search" hint="Discover products, creators, and trends." />} />
                <Route path="/create" element={<Placeholder title="Create" hint="Post a product, photo, or story." />} />
                <Route path="/activity" element={<Placeholder title="Activity" hint="Likes, comments, and follows will show here." />} />
                <Route path="/profile" element={<Placeholder title="Your Profile" hint="Manage your shop, posts, and account." />} />
              </Route>
              <Route path="/index" element={<Navigate to="/home" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ShopProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
