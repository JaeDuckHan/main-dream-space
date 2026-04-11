import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PlannerBar from "@/components/PlannerBar";
import Index from "./pages/Index.tsx";
import Living from "./pages/Living.tsx";
import Retire from "./pages/Retire.tsx";
import Community from "./pages/Community.tsx";
import Planner from "./pages/Planner.tsx";
import Compare from "./pages/Compare.tsx";
import Directory from "./pages/Directory.tsx";
import Insight from "./pages/Insight.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PlannerBar />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/living" element={<Living />} />
          <Route path="/retire" element={<Retire />} />
          <Route path="/community" element={<Community />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/insight" element={<Insight />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
