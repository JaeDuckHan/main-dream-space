import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardBar from "@/components/DashboardBar";
import KakaoChannelButton from "@/components/KakaoChannelButton";
import Navbar, { GlobalNavbarContext } from "@/components/Navbar";
import PlannerBar from "@/components/PlannerBar";
import { AuthProvider } from "@/hooks/use-auth";
import Index from "./pages/Index.tsx";
import Living from "./pages/Living.tsx";
import Retire from "./pages/Retire.tsx";
import Community from "./pages/Community.tsx";
import CommunityWrite from "./pages/CommunityWrite.tsx";
import CommunityPostDetail from "./pages/CommunityPostDetail.tsx";
import CommunityEdit from "./pages/CommunityEdit.tsx";
import CoffeeChats from "./pages/CoffeeChats.tsx";
import Residents from "./pages/Residents.tsx";
import ResidentMe from "./pages/ResidentMe.tsx";
import Planner from "./pages/Planner.tsx";
import Compare from "./pages/Compare.tsx";
import Directory from "./pages/Directory.tsx";
import Insight from "./pages/Insight.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import BusinessRegister from "./pages/BusinessRegister.tsx";
import BusinessDashboard from "./pages/BusinessDashboard.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import AdminHome from "./pages/admin/AdminHome.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminListings from "./pages/admin/AdminListings.tsx";
import ChecklistStatus from "./pages/ChecklistStatus.tsx";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSettings from "./pages/admin/AdminSettings";
import OrderNew from "./pages/OrderNew";
import MyOrders from "./pages/MyOrders";

const queryClient = new QueryClient();

const AppShell = () => (
  <GlobalNavbarContext.Provider value>
    <PlannerBar />
    <Navbar forceRender />
    <DashboardBar />
    <Outlet />
    <KakaoChannelButton />
  </GlobalNavbarContext.Provider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Index />} />
              <Route path="/living" element={<Living />} />
              <Route path="/retire" element={<Retire />} />
              <Route path="/community" element={<Community />} />
              <Route path="/community/write" element={<CommunityWrite />} />
              <Route path="/community/:id" element={<CommunityPostDetail />} />
              <Route path="/community/:id/edit" element={<CommunityEdit />} />
              <Route path="/coffee-chats" element={<CoffeeChats />} />
              <Route path="/residents" element={<Residents />} />
              <Route path="/residents/me" element={<ResidentMe />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/insight" element={<Insight />} />
              <Route path="/login" element={<Login />} />
              <Route path="/business/register" element={<BusinessRegister />} />
              <Route path="/business/dashboard" element={<BusinessDashboard />} />
              <Route path="/checklist" element={<ChecklistStatus />} />
              <Route path="/orders/new" element={<OrderNew />} />
              <Route path="/my/orders" element={<MyOrders />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/listings" element={<AdminListings />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
