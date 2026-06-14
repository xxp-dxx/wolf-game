import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSocket } from "./hooks/use-socket";
import { Screens } from "./components/Screens";

const queryClient = new QueryClient();

function MainApp() {
  const socketProps = useSocket();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return <Screens {...socketProps} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
