export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        background: "#030813",
        color: "#f3f6ff",
        padding: "24px"
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "40px", margin: 0 }}>404</h1>
        <p style={{ marginTop: "10px", opacity: 0.8 }}>The page you requested does not exist.</p>
      </div>
    </main>
  );
}
