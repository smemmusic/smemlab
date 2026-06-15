import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./content/journeys/validate.js"; // throws at startup on a malformed journey
import "./styles/global.css";
import "./styles/puzzle.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
