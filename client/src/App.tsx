import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Devices from "./pages/Devices";
import Messages from "./pages/Messages";
import History from "./pages/History";
import Docs from "./pages/Docs";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/devices"} component={Devices} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/history"} component={History} />
      <Route path={"/docs"} component={Docs} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            toastOptions={{
              style: {
                background: "oklch(0.12 0.015 280)",
                border: "1px solid oklch(0.85 0.18 195 / 30%)",
                color: "oklch(0.9 0.01 210)",
                fontFamily: "'Share Tech Mono', monospace",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
