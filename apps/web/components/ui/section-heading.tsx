type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function SectionHeading({ eyebrow, title, body }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm uppercase tracking-[0.32em] text-white/45">{eyebrow}</p>
      <h2 className="font-display text-3xl font-semibold text-white md:text-5xl">{title}</h2>
      <p className="text-base leading-8 text-white/68 md:text-lg">{body}</p>
    </div>
  );
}
