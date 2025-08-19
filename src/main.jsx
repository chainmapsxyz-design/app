// /src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import Login from "./auth/Login.jsx";

function Root() {
  const { isAuthed } = useAuth();
  return isAuthed ? <App /> : <Login />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
