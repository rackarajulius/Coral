import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PrivacyPolicyTOC } from '@/components/PrivacyPolicyTOC/PrivacyPolicyTOC';
import { ArrowLeft, Shield, Lock, Eye, Trash2, Edit3, FileText } from 'lucide-react';
import EmployerNavbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


export default function PrivacyPolicy() {
  useDocumentTitle("Privacy Policy");

  useEffect(() => {
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Learn how we protect your privacy and handle your personal data. Your resume and personal information are encrypted and never sold to third parties.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Learn how we protect your privacy and handle your personal data. Your resume and personal information are encrypted and never sold to third parties.';
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen pt-20 md:pt-24 lg:pt-10">
        <EmployerNavbar/>
    
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="lg:flex lg:gap-12">
          {/* Sticky Sidebar - Desktop */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <PrivacyPolicyTOC />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-3xl">
            {/* Mobile TOC */}
            <div className="lg:hidden mb-8 p-4 bg-card rounded-lg border">
              <PrivacyPolicyTOC />
            </div>

            {/* Page Title */}
            <div className="mb-10">
              <h1 className="legal-heading text-3xl md:text-4xl text-foreground mb-3">
                Privacy Policy
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 5, 2026
              </p>
            </div>

            {/* Introduction */}
            <section id="introduction" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Introduction
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  Welcome to our Privacy Policy. We are committed to protecting your personal 
                  information and your right to privacy. When you use our resume platform, 
                  you trust us with your personal data, and we take that responsibility seriously.
                </p>
                <p>
                  This Privacy Policy explains what information we collect, how we use it, 
                  and what rights you have in relation to it. We encourage you to read this 
                  policy carefully to understand our practices.
                </p>
                <div className="legal-highlight-box flex items-start gap-3 mt-6">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    <strong>Our Commitment:</strong> Your privacy is our priority. We never sell 
                    your personal data or resume information to third parties.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Collection */}
            <section id="data-collection" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Data Collection
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  We collect information that you provide directly to us, as well as information 
                  automatically collected when you use our services.
                </p>
                
                <h3 className="font-semibold text-foreground mt-6 mb-3">Information You Provide</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Resume Content:</strong> Your work history, education, skills, and 
                      other professional information included in your resume.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Contact Information:</strong> Your name, email address, phone number, 
                      and other contact details you choose to provide.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Account Information:</strong> Login credentials and profile preferences 
                      you create when registering for our services.
                    </div>
                  </li>
                </ul>

                <h3 className="font-semibold text-foreground mt-6 mb-3">Automatically Collected Information</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Usage Data:</strong> Information about how you interact with our 
                      platform, including pages visited, features used, and time spent.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Device Information:</strong> Browser type, operating system, and 
                      device identifiers used to access our services.
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            {/* Resume Protection */}
            <section id="resume-protection" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Resume Protection
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  We understand that your resume contains sensitive personal and professional 
                  information. That's why we've implemented robust security measures to protect it.
                </p>

                <div className="grid gap-4 mt-6">
                  <div className="legal-highlight-box flex items-start gap-3">
                    <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">End-to-End Encryption</strong>
                      <p className="text-sm mt-1">
                        All resumes are encrypted using industry-standard AES-256 encryption, 
                        both in transit and at rest.
                      </p>
                    </div>
                  </div>
                  
                  <div className="legal-highlight-box flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Never Sold to Third Parties</strong>
                      <p className="text-sm mt-1">
                        Your resume and personal information are never sold, rented, or traded 
                        to recruiters, employers, or any third parties without your explicit consent.
                      </p>
                    </div>
                  </div>
                  
                  <div className="legal-highlight-box flex items-start gap-3">
                    <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Controlled Visibility</strong>
                      <p className="text-sm mt-1">
                        You have complete control over who can view your resume. Share only 
                        when and with whom you choose.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Cookie Usage */}
            <section id="cookie-usage" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Cookie Usage
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  We use cookies and similar tracking technologies to enhance your experience 
                  on our platform. Here's how we categorize and use them:
                </p>

                <div className="mt-6 space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <h3 className="font-semibold text-foreground">Essential Cookies</h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Always Active
                      </span>
                    </div>
                    <p className="text-sm">
                      Required for the platform to function properly. These cookies enable core 
                      features like security, account access, and remembering your preferences. 
                      They cannot be disabled.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <h3 className="font-semibold text-foreground">Functional Cookies</h3>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm">
                      Enhance your experience by remembering choices you make, such as language 
                      preferences, display settings, and recently viewed content.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <h3 className="font-semibold text-foreground">Marketing Cookies</h3>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm">
                      Used to deliver relevant advertisements and measure the effectiveness 
                      of our marketing campaigns. These cookies may be set by our advertising partners.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  You can manage your cookie preferences at any time through your browser settings 
                  or by using the cookie banner when you first visit our site.
                </p>
              </div>
            </section>

            {/* Your Rights */}
            <section id="your-rights" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Your Rights
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  You have significant rights regarding your personal data. We are committed 
                  to helping you exercise these rights easily and transparently.
                </p>

                <div className="grid gap-4 mt-6">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <Eye className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Right to Access</h3>
                      <p className="text-sm">
                        You can request a copy of all personal data we hold about you. We will 
                        provide this information in a commonly used, machine-readable format 
                        within 30 days of your request.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <Edit3 className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Right to Correct</h3>
                      <p className="text-sm">
                        If any of your personal information is inaccurate or incomplete, you 
                        have the right to request corrections. You can update most information 
                        directly through your account settings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <Trash2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Right to Be Forgotten (Account Deletion)</h3>
                      <p className="text-sm">
                        You can request complete deletion of your account and all associated 
                        personal data. Upon verification, we will permanently remove your 
                        information from our systems within 30 days, except where retention 
                        is required by law.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-6">
                  To exercise any of these rights, please contact our privacy team at{' '}
                  <a href="mailto:privacy@example.com" className="text-primary underline underline-offset-2 hover:opacity-80">
                    privacy@example.com
                  </a>
                </p>
              </div>
            </section>

            {/* Disclaimer */}
            <div className="mt-10 p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Disclaimer:</strong> This Privacy Policy is provided for informational 
                purposes only and does not constitute legal advice. While we strive to keep 
                this policy accurate and up to date, we recommend consulting with a legal 
                professional for advice specific to your situation.
              </p>
            </div>

            {/* Related Pages */}
            <div className="mt-8 p-4 border rounded-lg">
              <h3 className="font-semibold text-foreground mb-3">Related Policies</h3>
              <Link 
                to="/terms-of-service" 
                className="inline-flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
              >
                <FileText className="h-4 w-4" />
                <span className="underline underline-offset-2">Terms of Service</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
   <ScrollToTop />
   <Footer/>
    </div>
  );
}
