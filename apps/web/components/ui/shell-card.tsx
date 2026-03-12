import { clsx } from "clsx";

type ShellCardProps = {
  className?: string;
  children: React.ReactNode;
};

export function ShellCard({ className, children }: ShellCardProps) {
  return <div className={clsx("panel noise rounded-[28px]", className)}>{children}</div>;
}
