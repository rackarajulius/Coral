import { useEffect, useState } from 'react';
import { 
  FileText, 
  UserCheck, 
  Laptop, 
  FileEdit, 
  Users, 
  Shield, 
  Ban, 
  AlertTriangle, 
  Scale, 
  RefreshCw, 
  Gavel 
} from 'lucide-react';

interface TOCItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const tocItems: TOCItem[] = [
  { id: 'introduction', title: 'Introduction', icon: <FileText className="h-4 w-4" /> },
  { id: 'eligibility', title: 'Eligibility & Registration', icon: <UserCheck className="h-4 w-4" /> },
  { id: 'use-of-platform', title: 'Use of the Platform', icon: <Laptop className="h-4 w-4" /> },
  { id: 'user-content', title: 'User Content', icon: <FileEdit className="h-4 w-4" /> },
  { id: 'employer-interactions', title: 'Employer Interactions', icon: <Users className="h-4 w-4" /> },
  { id: 'privacy', title: 'Privacy & Data Protection', icon: <Shield className="h-4 w-4" /> },
  { id: 'suspension', title: 'Suspension & Termination', icon: <Ban className="h-4 w-4" /> },
  { id: 'disclaimers', title: 'Disclaimers', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'liability', title: 'Limitation of Liability', icon: <Scale className="h-4 w-4" /> },
  { id: 'changes', title: 'Changes to Terms', icon: <RefreshCw className="h-4 w-4" /> },
  { id: 'governing-law', title: 'Governing Law', icon: <Gavel className="h-4 w-4" /> },
];

interface TermsOfServiceTOCProps {
  className?: string;
}

export function TermsOfServiceTOC({ className = '' }: TermsOfServiceTOCProps) {
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
