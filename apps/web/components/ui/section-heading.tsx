type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function SectionHeading({ eyebrow, title, body }: SectionHeadingProps) {
  return (
    <div className="max-w-xl space-y-5">
      <p className="label-accent text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">{eyebrow}</p>
      <h2 className="font-display text-[1.85rem] font-semibold leading-[1.18] tracking-tight text-white md:text-[2.6rem]">{title}</h2>
      <p className="text-[13.5px] leading-[1.85] text-white/55 md:text-[15px]">{body}</p>
    </div>
  );
}
