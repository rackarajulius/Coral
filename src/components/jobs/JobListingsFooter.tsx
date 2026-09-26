const JobListingsFooter = () => {
  return (
    <footer className="py-6 px-4 text-center bg-card border-t border-border mt-4">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} JobSearch. All rights reserved.
      </p>
      <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <a href="/privacy-policy" className="hover:text-foreground transition-colors">
           Privacy Policy
        </a>
        <span>·</span>
        <a href="/terms-of-service" className="hover:text-foreground transition-colors">
           Terms of Service
        </a>
        <span>·</span>
        <a href="#" className="hover:text-foreground transition-colors">
          Help
        </a>
      </div>
    </footer>
  );
};

export default JobListingsFooter;
