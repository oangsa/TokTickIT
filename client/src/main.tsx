import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Inter with the system fallback stack (ui-spec Section 3.2). Weights map to
// body, field labels, section titles/buttons, and page titles.
//
// Latin and Latin Extended only. The unsuffixed `400.css` entry points pull
// every subset Inter ships (Cyrillic, Greek, Vietnamese); `unicode-range` keeps
// browsers from downloading them, but all 56 files are still emitted into the
// build and deployed. Latin Extended is kept because Ticket Summary and
// Description are free text and requester names carry accents.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
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
