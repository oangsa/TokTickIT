import { useState } from "react";
import { checkSystem, Category } from "../api.js";

/*
 * Lab 1 system-check screen. Lab 2 replaced it with the routed shell, so no route
 * renders it any more and `/system-check` resolves to the global 404; it is kept
 * only so the Lab 1 behaviour and its tests stay valid. Delete it together with
 * `tests/lab-01/App.test.tsx` once Lab 1 evidence is no longer required.
 */

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function SystemCheck() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-primary">IT Service Desk</span>
      </h1>

      <button className="btn btn-primary" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <>
          <p className="tt-success mt-3 mb-0">
            Backend status: <strong>Online</strong>
          </p>
          <h2 className="h5 mt-4">Categories</h2>
          <ul className="list-group">
            {categories.length === 0 && (
              <li className="list-group-item text-muted">No categories yet.</li>
            )}
            {categories.map((category) => (
              <li key={category.id} className="list-group-item">
                {category.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {state === "error" && (
        <p className="alert alert-danger mt-3 mb-0">
          Backend status: <strong>Offline</strong>
        </p>
      )}
    </div>
  );
}
