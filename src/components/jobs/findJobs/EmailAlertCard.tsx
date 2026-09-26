import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmailAlertCard = () => {
  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-orange-500">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground mb-1">
            Get the latest IT jobs
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Receive personalized job alerts straight to your inbox
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border
               bg-card focus:outline-none "
            />
            <Button variant="default" size="sm" className="text-xs px-3 py-1.5 h-auto">
              Subscribe
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailAlertCard;
