import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route
 * 
 * @example
 * @Roles(UserRole.ADMIN, UserRole.EMPLOYER)
 * @Get('admin/users')
 * getUsers() {
 *   return this.usersService.findAll();
 * }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);