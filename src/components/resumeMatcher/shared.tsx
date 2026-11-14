export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">{children}</div>
  );
}

export function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-coral">•</span>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
