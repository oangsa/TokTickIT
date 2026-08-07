import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  void categories;

  async function handleCheck() {
    setState("loading");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not reach the TokTickIT API.",
      );
      setState("error");
    }
    // TODO(Issue 4): render the fetched categories in the success state.
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <p className="alert alert-success mt-3 mb-0">
          Backend status: <strong>Online</strong>
        </p>
      )}

      {state === "error" && (
        <p className="alert alert-danger mt-3 mb-0">
          Backend status: <strong>Offline</strong> — {errorMessage}
        </p>
      )}

      {/* TODO(Issue 4): render the seeded categories inside the success state. */}
    </div>
  );
}
