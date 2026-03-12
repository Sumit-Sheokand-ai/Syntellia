export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10 xl:px-14">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}
