import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { BRAND_INPUT_CLASSES } from './brandStyles';

const BrandInput = ({ className, ...props }: React.ComponentProps<'input'>) => {
  return (
    <Input
      {...props}
      className={cn(BRAND_INPUT_CLASSES, className)}
    />
  );
};

export default BrandInput;
