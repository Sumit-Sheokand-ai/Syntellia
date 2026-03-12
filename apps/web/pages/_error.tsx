import type { NextPageContext } from "next";

type ErrorPageProps = {
  statusCode?: number;
};

function ErrorPage({ statusCode }: ErrorPageProps) {
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
        <h1 style={{ fontSize: "40px", margin: 0 }}>{statusCode ?? 500}</h1>
        <p style={{ marginTop: "10px", opacity: 0.8 }}>Something went wrong while rendering this page.</p>
      </div>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
