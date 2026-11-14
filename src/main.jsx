import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import App from "./App.jsx";
import "./styles.css";

if (Capacitor.getPlatform() === "ios") {
  document.documentElement.classList.add("native-ios");
  SystemBars.setStyle({ bar: SystemBarType.StatusBar, style: SystemBarsStyle.Dark }).catch(() => {});
  SystemBars.show({ animation: "NONE", bar: SystemBarType.StatusBar }).catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
