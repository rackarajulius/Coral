export default function JobStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  );
}
