
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { initDatabase } from "./lib/dbInit";
import { setupSqlFunction } from "./lib/setupSqlFunction";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Only retry once to avoid excessive error messages
    },
  },
});

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // First create the SQL execution function if needed
        await setupSqlFunction();
        // Then initialize the database tables
        await initDatabase();
        toast.success('Database initialized successfully');
        setInitializing(false);
      } catch (error) {
        console.error('Database initialization failed:', error);
        setInitError('Failed to initialize database. Please check console for details.');
        setInitializing(false);
        
        // Refresh the query client to retry fetching data
        queryClient.invalidateQueries();
      }
    };

    initializeDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {initializing && (
          <div className="fixed inset-0 flex items-center justify-center bg-white/50 z-50">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white shadow-lg">
              <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
              <p className="text-sm text-slate-600">Initializing database...</p>
            </div>
          </div>
        )}
        {initError && (
          <div className="max-w-4xl mx-auto mt-8 px-4">
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Database Error</AlertTitle>
              <AlertDescription>
                {initError}
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
