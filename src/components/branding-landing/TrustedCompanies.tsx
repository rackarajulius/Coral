const companies = ['Stripe', 'Shopify', 'Airbnb', 'Notion', 'Datadog', 'Figma', 'Vercel', 'Linear'];

const TrustedCompanies = () => {
  return (
    <section className="py-16 bg-background border-y border-border">
      <div className="container mx-auto px-4 md:px-12 lg:px-24 text-center">
        <p className="text-sm font-medium text-muted-foreground mb-8 tracking-wide uppercase">
          Trusted by hiring teams at leading companies
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
          {companies.map((name) => (
            <span
              key={name}
              className="text-xl font-bold text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-300 select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedCompanies;
