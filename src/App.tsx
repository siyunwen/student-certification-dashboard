
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { isSupabaseConfigured } from "./lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const queryClient = new QueryClient();

const App = () => {
  // Check if Supabase is properly configured
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!supabaseConfigured && (
          <div className="max-w-4xl mx-auto mt-8 px-4">
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Supabase configuration missing</AlertTitle>
              <AlertDescription>
                Please set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables to connect to Supabase.
                You can find these values in your Supabase project settings.
              </AlertDescription>
            </Alert>
          </div>
        )}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
