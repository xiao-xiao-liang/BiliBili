import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, ThemeProvider } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { AuthModalProvider } from "@/features/auth/AuthModal";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AuthModalProvider>
          <AppRouter />
          <Toaster position="bottom-right" />
        </AuthModalProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
