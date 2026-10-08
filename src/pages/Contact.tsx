import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Clock, Shield } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Contact() {
  useDocumentTitle("Contact Us");

  useEffect(() => {
    const metaDescription = document.querySelector('meta[name="description"]');
    const content =
      "Get in touch with our support team. We typically respond within 24 hours to help with technical issues, privacy inquiries, and more.";
    if (metaDescription) {
      metaDescription.setAttribute("content", content);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = content;
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
        <Header/>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <div className="flex items-center gap-2 text-primary">
              <Mail className="h-5 w-5" />
              <span className="font-semibold">Contact Us</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 lg:py-14">
        {/* Page Title */}
        <div className="text-center mb-10 lg:mb-14">
          <h1 className="legal-heading text-3xl md:text-4xl text-foreground mb-3">
            Contact Us
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Have a question or need assistance? Our support team is here to help.
            Fill out the form below and we'll get back to you promptly.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 max-w-5xl mx-auto">
          {/* Left Column — Contact Info */}
          <aside className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="legal-heading text-lg text-foreground mb-5">
                Get in Touch
              </h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-coral flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      Headquarters
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      123 Innovation Drive
                      <br />
                      Suite 400
                      <br />
                      San Francisco, CA 94105
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-coral flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      Support Email
                    </h3>
                    <a
                      href="mailto:support@yourportal.com"
                      className="text-sm text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      support@yourportal.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-coral flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      Response Time
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      We typically respond within 24 hours during business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Assurance */}
            <div className="legal-highlight-box flex items-start gap-3 border border-gray-300 bg-white">
              <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-foreground text-sm">
                  Your Privacy is Protected
                </strong>
                <p className="text-sm text-muted-foreground mt-1">
                  All inquiries are handled confidentially. Read our{" "}
                  <Link
                    to="/privacy-policy"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Privacy Policy
                  </Link>{" "}
                  to learn more.
                </p>
              </div>
            </div>
          </aside>

          {/* Right Column — Contact Form */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-gray-300 rounded-xl p-6 md:p-8 shadow-sm">
              <h2 className="legal-heading text-lg text-foreground mb-6">
                Send Us a Message
              </h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
     <Footer/>
    </div>
  );
}
