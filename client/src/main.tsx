import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Inter with the system fallback stack (ui-spec Section 3.2). Weights map to
// body, field labels, section titles/buttons, and page titles.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "bootstrap/dist/css/bootstrap.min.css";
// Import order is load-bearing: the Zen Green overrides win on source order.
import "./styles/theme.css";
import "./styles/components.css";
import App from "./App.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
