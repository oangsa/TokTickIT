import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/Online/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  it("shows an empty message when the API returns no categories", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({ online: true, categories: [] });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/No categories yet\./)).toBeInTheDocument();
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolve: (status: api.SystemStatus) => void;
    vi.spyOn(api, "checkSystem").mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<App />);
    const button = screen.getByRole("button", { name: /check system/i });
    await userEvent.click(button);

    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();

    resolve!({ online: true, categories: [] });
    expect(await screen.findByText(/Online/)).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(
      new Error("Cannot reach the TokTickIT API at http://localhost:3000."),
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/Offline/)).toBeInTheDocument();
    expect(
      screen.getByText(/Cannot reach the TokTickIT API at http:\/\/localhost:3000\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
