import { cn } from '@/lib/utils';
import { Input } from '../ui/input';

const BrandInput = ({ className, ...props }: React.ComponentProps<'input'>) => {
  return (
    <Input
      {...props}
      className={cn('w-full rounded-[14px] px-4 text-[16px] bg-card transition-all duration-200', className)}
    />
  );
};

export default BrandInput;
