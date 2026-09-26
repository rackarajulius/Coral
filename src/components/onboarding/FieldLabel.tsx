import React from 'react';
import { Label } from '../ui/label';

const FieldLabel = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => {
  return (
    <Label htmlFor={htmlFor} className="text-[14px] font-semibold">
      {children}
    </Label>
  );
};

export default FieldLabel;
