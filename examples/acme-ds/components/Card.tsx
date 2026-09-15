export type CardProps = {
  title: string;
  subtitle?: string;
  children: unknown;
};

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      <div>{children}</div>
    </section>
  );
}
