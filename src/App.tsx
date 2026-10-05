import React from "react";
import { AuthProvider } from "./auth/AuthProvider";
import Main from "./pages/Main";

export default function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
}
