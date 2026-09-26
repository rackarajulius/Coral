import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../types/user.types';

/**
 * Decorator to extract the current user from the request
 * 
 * @example
 * @Get('me')
 * getCurrentUser(@CurrentUser() user: User) {
 *   return user;
 * }
 * 
 * @example
 * // Get specific property
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return { id: userId };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | User[keyof User] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);