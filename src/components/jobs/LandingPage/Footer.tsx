import { Briefcase ,Linkedin, Facebook, Instagram } from "lucide-react";
import { IconBrandX } from "@tabler/icons-react";
import { BRAND_NAME } from "@/lib/brand";

const Footer = () => {
  return (
    <footer className="py-16 px-6 bg-secondary/50 border-t border-border">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <a href="/" className="flex items-center gap-2 font-display font-semibold text-xl text-foreground mb-4">
              <Briefcase className="h-6 w-6 text-accent" />
              <span>{BRAND_NAME}</span>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed">
             We connect talented people with meaningful opportunities at leading
          companies, NGOs, and remote teams around the world.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">For Job Seekers</h4>
            <ul className="space-y-3">
              {["Browse Jobs", "Saved Jobs", "Job Alerts", "Career Advice"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">For Employers</h4>
            <ul className="space-y-3">
              {["Post a Job", "Browse Resumes", "Pricing", "Employer Dashboard"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col">
               <h4 className="font-semibold text-foreground mb-4">Company</h4>
                  <ul className="space-y-3 mb-8">
                     <li>
                     <a href="/about-us" className="text-sm text-foreground hover:text-coral transition-colors"> About Us </a>
                    </li>
                      <li>
                          <a href="/contact-us" className="text-sm text-foreground hover:text-coral transition-colors"> Contact Us </a>
                       </li>
                  </ul>

               {/* Social Icons */}
             <div className="flex items-center gap-3 mt-auto">
    {[
      { icon: IconBrandX, href: "https://twitter.com", label: "Twitter" },
      { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
      { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
      { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
    ].map(({ icon: Icon, href, label }) => (
      <a
        key={label}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
       className="flex items-center justify-center w-8 h-8 rounded-full 
bg-muted text-muted-foreground 
hover:bg-foreground hover:text-background 
transition-all duration-200"
      >
        <Icon className="h-5 w-5" />
      </a>
    ))}
  </div>
</div>
        </div>

        <div className="pt-8 border-t border-gray-300 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <ul className="flex items-center gap-6 text-sm text-muted-foreground">
  <li>
    <a href="/privacy-policy" className="hover:text-foreground transition-colors">
      Privacy Policy
    </a>
  </li>
  <li>
    <a href="/terms-of-service" className="hover:text-foreground transition-colors">
      Terms of Service
    </a>
  </li>
   <li>
    <a href="/terms-of-service" className="hover:text-foreground transition-colors">
      Cookie Policy
    </a>
  </li>
</ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
