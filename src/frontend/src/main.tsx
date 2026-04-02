import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { InternetIdentityProvider } from "./hooks/useInternetIdentity";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#111",
            color: "#fff",
            flexDirection: "column",
            gap: "16px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: "24px" }}>♪</div>
          <p>Something went wrong. Please refresh.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              background: "oklch(0.72 0.18 145.6)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InternetIdentityProvider>
          <App />
        </InternetIdentityProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
);
