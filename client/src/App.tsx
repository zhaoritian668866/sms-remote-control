import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GlobalNotification } from "./components/GlobalNotification";
import Home from "./pages/Home";
import Devices from "./pages/Devices";
import Messages from "./pages/Messages";
import History from "./pages/History";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import SubAdmin from "./pages/SubAdmin";
import ExportNumbers from "./pages/ExportNumbers";
import Templates from "./pages/Templates";
import BulkSend from "./pages/BulkSend";
import Auditor from "./pages/Auditor";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"} component={Home} />
      <Route path={"/devices"} component={Devices} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/history"} component={History} />
      <Route path={"/chat/:id"} component={Chat} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/sub-admin"} component={SubAdmin} />
      <Route path={"/export"} component={ExportNumbers} />
      <Route path={"/templates"} component={Templates} />
      <Route path={"/bulk-send"} component={BulkSend} />
      <Route path={"/auditor"} component={Auditor} />
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
          <Toaster />
          <GlobalNotification />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
