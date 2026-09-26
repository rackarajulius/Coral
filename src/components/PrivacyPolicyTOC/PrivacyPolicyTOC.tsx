import { useEffect, useState } from 'react';
import { FileText, Database, Shield, Cookie, UserCheck } from 'lucide-react';

interface TOCItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const tocItems: TOCItem[] = [
  { id: 'introduction', title: 'Introduction', icon: <FileText className="h-4 w-4" /> },
  { id: 'data-collection', title: 'Data Collection', icon: <Database className="h-4 w-4" /> },
  { id: 'resume-protection', title: 'Resume Protection', icon: <Shield className="h-4 w-4" /> },
  { id: 'cookie-usage', title: 'Cookie Usage', icon: <Cookie className="h-4 w-4" /> },
  { id: 'your-rights', title: 'Your Rights', icon: <UserCheck className="h-4 w-4" /> },
];

interface PrivacyPolicyTOCProps {
  className?: string;
}

export function PrivacyPolicyTOC({ className = '' }: PrivacyPolicyTOCProps) {
  const [activeSection, setActiveSection] = useState<string>('introduction');

  useEffect(() => {
    const handleScroll = () => {
      const sections = tocItems.map(item => ({
        id: item.id,
        element: document.getElementById(item.id),
      }));

      const scrollPosition = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.element && section.element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <nav className={`space-y-1 ${className}`} aria-label="Table of Contents">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 px-3">
        Contents
      </h2>
      {tocItems.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollToSection(item.id)}
          className={`legal-toc-item w-full flex items-center gap-2 text-left ${
            activeSection === item.id ? 'active' : 'text-foreground hover:text-foreground'
          }`}
          aria-current={activeSection === item.id ? 'true' : undefined}
        >
          {item.icon}
          <span>{item.title}</span>
        </button>
      ))}
    </nav>
  );
}
