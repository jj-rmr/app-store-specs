import React from "react";
import { AuthProvider } from "./auth/AuthProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import Main from "./pages/Main";

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary name="app">
        <Main />
      </ErrorBoundary>
    </AuthProvider>
  );
}
