import type { CSSProperties, ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type StarBorderProps<T extends ElementType> = ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  children?: ReactNode;
  color?: string;
  speed?: CSSProperties["animationDuration"];
  thickness?: number;
  innerClassName?: string;
};

export function StarBorder<T extends ElementType = "button">({
  as,
  className = "",
  color = "white",
  speed = "6s",
  thickness = 1,
  children,
  innerClassName = "",
  ...rest
}: StarBorderProps<T>) {
  const Component = as ?? "button";

  return (
    <Component
      className={`star-border-container ${className}`}
      {...(rest as ComponentPropsWithoutRef<T>)}
      style={{
        padding: `${thickness}px 0`,
        ...((rest as ComponentPropsWithoutRef<T>).style as CSSProperties | undefined)
      }}
    >
      <span
        className="star-border-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <span
        className="star-border-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <span className={`star-border-content ${innerClassName}`}>{children}</span>
    </Component>
  );
}