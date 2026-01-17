import React from "react";
import ReactDOM from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import App from "./App.tsx";
import { TypographyProvider } from "./components/Typography";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <TypographyProvider className="dark text-foreground bg-background">
        <App />
      </TypographyProvider>
    </HeroUIProvider>
  </React.StrictMode>,
);
