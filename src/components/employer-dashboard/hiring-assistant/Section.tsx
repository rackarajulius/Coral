// components/ui/Section.tsx
// Wraps each workspace section.  Shows a shimmer skeleton until `revealed`.

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  revealed: boolean;
}

export function Section({ title, subtitle, children, revealed }: SectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>

      {revealed ? (
        <div className="animate-fade-in">{children}</div>
      ) : (
        <SectionSkeleton />
      )}
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 rounded-xl shimmer opacity-60" />
      ))}
    </div>
  );
}