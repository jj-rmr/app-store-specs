import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/latin-700.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-900.css";
import App from "./App";
import "./styles/tailwind.css";

const fontRequests = [
  document.fonts.load('700 1em "Fredoka"'),
  document.fonts.load('400 1em "Nunito"'),
  document.fonts.load('700 1em "Nunito"'),
  document.fonts.load('900 1em "Nunito"'),
];

const fontTimeout = new Promise<void>((resolve) => {
  window.setTimeout(resolve, 1500);
});

async function startApp() {
  await Promise.race([Promise.all(fontRequests), fontTimeout]);

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/font-cache-worker.js");
    });
  }
}

void startApp();
