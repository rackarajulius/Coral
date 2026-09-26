import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { 
  ArrowLeft, 
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
  Gavel,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { TermsOfServiceTOC } from '@/components/TermsOfService/TermsOfServiceTOC';
import EmployerNavbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ScrollToTop from '@/components/ui/ScrollToTop';


export default function TermsOfService() {
  useEffect(() => {
    document.title = 'Terms of Service | Your Resume Platform';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Read our Terms of Service to understand your rights and responsibilities when using our resume platform. Clear, fair terms for job seekers.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Read our Terms of Service to understand your rights and responsibilities when using our resume platform. Clear, fair terms for job seekers.';
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background pt-20 md:pt-24 lg:pt-10">
      <EmployerNavbar/>
     
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="lg:flex lg:gap-12">
          {/* Sticky Sidebar - Desktop */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <TermsOfServiceTOC />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-3xl">
            {/* Mobile TOC */}
            <div className="lg:hidden mb-8 p-4 bg-background rounded-lg border border-border">
              <TermsOfServiceTOC />
            </div>

            {/* Page Title */}
            <div className="mb-10">
              <h1 className="legal-heading text-3xl md:text-4xl text-foreground mb-3">
                Terms of Service
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
                  Welcome to our resume platform. These Terms of Service ("Terms") govern your 
                  access to and use of our website, applications, and services (collectively, 
                  the "Platform"). By accessing or using the Platform, you agree to be bound 
                  by these Terms.
                </p>
                <p>
                  Please read these Terms carefully before using our services. If you do not 
                  agree with any part of these Terms, you may not access or use the Platform.
                </p>
                <div className="legal-highlight-box flex items-start gap-3 mt-6">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    <strong>Binding Agreement:</strong> By creating an account or using our Platform, 
                    you acknowledge that you have read, understood, and agree to be bound by these 
                    Terms and our <Link to="/privacy-policy" className="text-primary underline underline-offset-2 hover:opacity-80">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </section>

            {/* Eligibility & Account Registration */}
            <section id="eligibility" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Eligibility & Account Registration
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  To use our Platform, you must meet certain eligibility requirements and 
                  maintain accurate account information.
                </p>

                <h3 className="font-semibold text-foreground mt-6 mb-3">Age Requirement</h3>
                <p>
                  You must be at least 16 years old to create an account and use our services. 
                  If you are between 16 and 18 years old, you represent that you have obtained 
                  parental or guardian consent to use the Platform.
                </p>

                <h3 className="font-semibold text-foreground mt-6 mb-3">Account Responsibilities</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Accurate Information:</strong> You agree to provide accurate, current, 
                      and complete information when creating your account and to update this 
                      information as necessary.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Account Security:</strong> You are responsible for maintaining the 
                      confidentiality of your login credentials and for all activities that occur 
                      under your account.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <strong>Notification of Breach:</strong> You agree to notify us immediately 
                      of any unauthorized use of your account or any other breach of security.
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            {/* Use of the Platform */}
            <section id="use-of-platform" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Use of the Platform
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  Our Platform is designed to help job seekers create, manage, and share their 
                  professional profiles and resumes. You agree to use the Platform only for its 
                  intended purposes and in accordance with these Terms.
                </p>

                <div className="grid gap-4 mt-6">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Permitted Uses</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        Creating and maintaining your professional profile and resume
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        Searching for and applying to job opportunities
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        Sharing your resume with potential employers
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        Using our tools to enhance your job search
                      </li>
                    </ul>
                  </div>

                  <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/5">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <h3 className="font-semibold text-foreground">Prohibited Activities</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                        Scraping, harvesting, or collecting data from the Platform
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                        Impersonating another person or entity
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                        Submitting false or misleading information
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                        Using the Platform for any unlawful purpose
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                        Interfering with or disrupting the Platform's operation
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* User Content */}
            <section id="user-content" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                User Content
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  You retain ownership of all content you submit to the Platform, including 
                  your resume, profile information, and any other materials you upload or create.
                </p>

                <div className="grid gap-4 mt-6">
                  <div className="legal-highlight-box flex items-start gap-3">
                    <FileEdit className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Your Content, Your Ownership</strong>
                      <p className="text-sm mt-1">
                        Your resumes, cover letters, and profile content remain your property. 
                        We do not claim ownership of any content you create or upload.
                      </p>
                    </div>
                  </div>

                  <div className="legal-highlight-box flex items-start gap-3">
                    <Laptop className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Limited License</strong>
                      <p className="text-sm mt-1">
                        By submitting content to the Platform, you grant us a limited, non-exclusive 
                        license to display, process, and store your content solely for the purpose 
                        of providing our services to you.
                      </p>
                    </div>
                  </div>

                  <div className="legal-highlight-box flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">No Sale of User Content</strong>
                      <p className="text-sm mt-1">
                        We will never sell, rent, or trade your resumes, profiles, or any personal 
                        content to third parties. Your information is used solely to provide and 
                        improve our services.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Employer Interactions */}
            <section id="employer-interactions" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Employer Interactions
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  Our Platform may facilitate connections between job seekers and potential 
                  employers. However, we act solely as an intermediary and do not participate 
                  in the hiring process.
                </p>

                <div className="border rounded-lg p-4 mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Important Notices</h3>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <strong>Intermediary Role:</strong> We provide tools to connect you with 
                        opportunities but are not a party to any employment relationship.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <strong>No Guarantees:</strong> We do not guarantee job placement, 
                        employer responses, or any particular outcome from using our services.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <strong>Independent Verification:</strong> You are responsible for 
                        verifying the legitimacy of any job opportunities or employers you 
                        connect with through the Platform.
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Privacy & Data Protection */}
            <section id="privacy" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Privacy & Data Protection
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  Your privacy is important to us. Our collection, use, and protection of your 
                  personal information is governed by our Privacy Policy, which is incorporated 
                  into these Terms by reference.
                </p>

                <div className="legal-highlight-box flex items-start gap-3 mt-6">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground">Privacy Policy</strong>
                    <p className="text-sm mt-1">
                      Please review our{' '}
                      <Link 
                        to="/privacy-policy" 
                        className="text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        Privacy Policy
                      </Link>{' '}
                      for detailed information about how we collect, use, and protect your 
                      personal data in accordance with applicable data protection laws.
                    </p>
                  </div>
                </div>

                <p className="mt-4">
                  By using the Platform, you consent to the collection and use of your information 
                  as described in the Privacy Policy.
                </p>
              </div>
            </section>

            {/* Account Suspension & Termination */}
            <section id="suspension" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Account Suspension & Termination
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  We reserve the right to suspend or terminate accounts that violate these 
                  Terms or engage in prohibited activities.
                </p>

                <h3 className="font-semibold text-foreground mt-6 mb-3">Grounds for Suspension or Termination</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Ban className="h-4 w-4 text-destructive mt-1 flex-shrink-0" />
                    <span>Violation of these Terms of Service</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Ban className="h-4 w-4 text-destructive mt-1 flex-shrink-0" />
                    <span>Engaging in prohibited activities as outlined above</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Ban className="h-4 w-4 text-destructive mt-1 flex-shrink-0" />
                    <span>Providing false or misleading information</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Ban className="h-4 w-4 text-destructive mt-1 flex-shrink-0" />
                    <span>Any activity that may harm other users or the Platform</span>
                  </li>
                </ul>

                <h3 className="font-semibold text-foreground mt-6 mb-3">Your Right to Delete</h3>
                <p>
                  You may delete your account at any time through your account settings. Upon 
                  deletion, your personal data will be handled in accordance with our{' '}
                  <Link 
                    to="/privacy-policy" 
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </section>

            {/* Disclaimers */}
            <section id="disclaimers" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Disclaimers
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground mb-2">"As Is" Service</strong>
                      <p className="text-sm">
                        The Platform and its services are provided on an "as is" and "as available" 
                        basis without warranties of any kind, either express or implied, including 
                        but not limited to implied warranties of merchantability, fitness for a 
                        particular purpose, or non-infringement.
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold text-foreground mt-6 mb-3">No Guarantees</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>We do not guarantee job availability or placement outcomes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>We do not guarantee responses from employers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>We do not guarantee uninterrupted or error-free service</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>We do not guarantee the accuracy of third-party content</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section id="liability" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Limitation of Liability
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  To the maximum extent permitted by applicable law, we shall not be liable 
                  for any indirect, incidental, special, consequential, or punitive damages, 
                  including but not limited to loss of profits, data, use, or other intangible 
                  losses.
                </p>

                <div className="legal-highlight-box flex items-start gap-3 mt-6">
                  <Scale className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-foreground">Reasonable Limitations</strong>
                    <p className="text-sm mt-1">
                      Our liability limitations are designed to be reasonable and consistent 
                      with applicable consumer protection laws. Nothing in these Terms shall 
                      limit or exclude liability that cannot be lawfully limited or excluded.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Changes to the Terms */}
            <section id="changes" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Changes to the Terms
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  We reserve the right to modify these Terms at any time. When we make changes, 
                  we will update the "Last updated" date at the top of this page and, where 
                  appropriate, provide additional notice through the Platform.
                </p>

                <div className="border rounded-lg p-4 mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">How We Notify You</h3>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      Updates to the "Last updated" date on this page
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      In-platform notifications for material changes
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      Email notifications for significant updates (if applicable)
                    </li>
                  </ul>
                </div>

                <p className="mt-4">
                  Your continued use of the Platform after any changes constitutes your 
                  acceptance of the updated Terms.
                </p>
              </div>
            </section>

            {/* Governing Law */}
            <section id="governing-law" className="legal-section">
              <h2 className="legal-heading text-xl md:text-2xl text-foreground mb-4">
                Governing Law
              </h2>
              <div className="legal-body space-y-4 text-foreground/90">
                <p>
                  These Terms shall be governed by and construed in accordance with applicable 
                  laws, without regard to conflict of law principles. Any disputes arising from 
                  these Terms or your use of the Platform shall be resolved in accordance with 
                  applicable law.
                </p>

                <div className="legal-highlight-box flex items-start gap-3 mt-6">
                  <Gavel className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    <strong>Dispute Resolution:</strong> We encourage you to contact us first 
                    to attempt to resolve any disputes informally before pursuing formal legal action.
                  </p>
                </div>
              </div>
            </section>

            {/* Disclaimer */}
            <div className="mt-10 p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Disclaimer:</strong> These Terms of Service are provided for informational 
                purposes only and do not constitute legal advice. While we strive to keep 
                these terms accurate and up to date, we recommend consulting with a legal 
                professional for advice specific to your situation.
              </p>
            </div>

            {/* Related Pages */}
            <div className="mt-8 p-4 border rounded-lg">
              <h3 className="font-semibold text-foreground mb-3">Related Policies</h3>
              <Link 
                to="/privacy-policy" 
                className="inline-flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
              >
                <Shield className="h-4 w-4" />
                <span className="underline underline-offset-2">Privacy Policy</span>
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
