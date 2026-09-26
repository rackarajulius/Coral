const SectionHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-end justify-between mb-5">
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export default SectionHeader;
