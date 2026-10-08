import { Link } from "react-router-dom";
import { Briefcase, Linkedin, Github, Globe, CircleCheck } from "lucide-react";
import { IconBrandX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { BRAND_NAME } from "@/lib/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const footerColumns = [
  {
    title: "All Features",
    links: [
      { label: "Employer Branding", path: "/employers/branding" },
      { label: "AI-Powered Hiring", path: "/employers/ai-hiring" },
      { label: "Advanced Analytics", path: "/employers/advanced-analytics" },
      { label: "Performance", path: "/employers/performance" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", path: "/help-center" },
      { label: "Blog", path: "/blog" },
      { label: "Case Studies", path: "/case-studies" },
      { label: "Webinars", path: "/webinars" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", path: "/about" },
      { label: "Careers", path: "/careers" },
      { label: "Press", path: "/press" },
      { label: "Contact", path: "/employer/contact-us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", path: "/privacy-policy" },
      { label: "Terms of Service", path: "/terms-of-service" },
      { label: "Security", path: "/security" },
      { label: "Compliance", path: "/compliance" },
    ],
  },
];

const socialLinks = [
  { icon: IconBrandX, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Github, href: "#", label: "GitHub" },
];

const Footer = () => {
  const isMobile = useIsMobile();

  return (
    <footer className="bg-secondary/50 ">

        <Separator/>

      {/* Main Footer Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg ">
                <Briefcase className="h-6 w-6 text-orange-500" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight">
                {BRAND_NAME}
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              The modern recruiting platform that helps employers find, engage, and hire top
              candidates with AI-powered tools.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground 
                  hover:bg-foreground hover:text-background transition-all duration-200"
                >
                  <s.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
            {/* Newsletter */}
            <div className="space-y-2.5 max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--footer-heading))]">
                Subscribe to our newsletter
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your Email"
                  className="h-9 border border-border text-foreground placeholder:text-muted-foreground text-sm"
                />
                <Button size="sm" className="h-9 shrink-0 text-sm">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {isMobile ? (
            <div className="lg:col-span-4">
              <Accordion type="multiple" className="w-full">
                {footerColumns.map((col) => (
                  <AccordionItem
                    key={col.title}
                    value={col.title}
                    className="border-b border-border"
                  >
                    <AccordionTrigger  className="py-4 text-xs font-semibold uppercase tracking-wider text-slate-500
                     hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:no-underline">
                      {col.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <ul className="space-y-3">
                        {col.links.map((link) => (
                          <li key={link.label}>
                            <Link
                              to={link.path}
                             className="text-sm text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
              {footerColumns.map((col) => (
                <div key={col.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">
                    {col.title}
                  </h3>
                  <ul className="space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          to={link.path}
                         className="text-sm text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-footer-foreground">
            <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>

            <div className="flex items-center gap-5">
              <Link to="/privacy-policy" className="transition-colors duration-200 hover:text-slate-900 dark:hover:text-white">
                Privacy
              </Link>
              <Link to="/terms-of-service" className="transition-colors duration-200 hover:text-slate-900 dark:hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
    </footer>
  );
};

export default Footer;
