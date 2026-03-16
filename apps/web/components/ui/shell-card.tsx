import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type ShellCardProps = HTMLAttributes<HTMLDivElement>;

export function ShellCard({ className, children, ...rest }: ShellCardProps) {
  return <div className={clsx("panel noise rounded-[28px]", className)} {...rest}>{children}</div>;
}
