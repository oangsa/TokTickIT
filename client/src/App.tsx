export default function App() {
  return (
    <main className="container py-5">
      <div className="card shadow-sm mx-auto" style={{ maxWidth: '32rem' }}>
        <div className="card-body text-center">
          <h1 className="card-title h3">TokTickIT</h1>
          <p className="text-body-secondary">
            React + TypeScript + Vite frontend with Bootstrap.
          </p>
          <span className="badge text-bg-success">Bootstrap is active</span>
          <div className="mt-4 d-grid gap-2 d-sm-flex justify-content-sm-center">
            <button type="button" className="btn btn-primary">
              Primary
            </button>
            <button type="button" className="btn btn-outline-secondary">
              Secondary
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
