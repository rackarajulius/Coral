const AuthDivider = ({ text = "Or continue with email" }: { text?: string }) => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-gray-300" />
    <span className="text-xs text-foreground/70 font-medium select-none">
      {text}
    </span>
    <div className="flex-1 h-px bg-gray-300" />
  </div>
);

export default AuthDivider;
