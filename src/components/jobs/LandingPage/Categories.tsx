import { Code, Palette, BarChart, Megaphone, Users, Wrench, HeartPulse, GraduationCap } from "lucide-react";

const categories = [
  { icon: Code, name: "Technology", jobs: "2,845" },
  { icon: Palette, name: "Design", jobs: "1,234" },
  { icon: BarChart, name: "Finance", jobs: "987" },
  { icon: Megaphone, name: "Marketing", jobs: "1,567" },
  { icon: Users, name: "Human Resources", jobs: "654" },
  { icon: Wrench, name: "Engineering", jobs: "2,123" },
  { icon: HeartPulse, name: "Healthcare", jobs: "1,890" },
  { icon: GraduationCap, name: "Education", jobs: "765" },
];

const Categories = () => {
  return (
    <section id="categories" className="py-24 bg-secondary/50">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-sm font-medium text-coral bg-coral/10 rounded-full">
            Categories
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Explore by Category
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Browse jobs across various industries and find the perfect match for your expertise.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category, index) => (
            <a
              key={category.name}
              href="#"
              className="group p-6 bg-card rounded-2xl border border-border hover:border-coral/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-12 h-12 mb-4 rounded-xl bg-coral/10 flex items-center justify-center group-hover:bg-coral transition-colors duration-300">
                <category.icon className="h-6 w-6 text-coral group-hover:text-accent-foreground transition-colors duration-300" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{category.name}</h3>
              <p className="text-sm text-muted-foreground">{category.jobs} jobs</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
