import { Link } from "react-router-dom";
import { Briefcase, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND_NAME } from "@/lib/brand";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8 sm:px-6">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.02] pointer-events-none" />

      {/* Logo - top left */}
      <Link
        to="/"
        className="relative z-10 flex items-center gap-2.5 mb-6"
      >
        <Briefcase className="h-6 w-6 text-coral" />
        <span className="font-display font-bold text-xl text-foreground tracking-tight">
          {BRAND_NAME}
        </span>
      </Link>

      <div className="flex-1 flex items-center justify-center">

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-[460px]"
      >
        {/* Auth card */}
        <div className="bg-card rounded-[18px]  p-7 sm:p-10 border border-gray-300">
          {children}
        </div>

      </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;
