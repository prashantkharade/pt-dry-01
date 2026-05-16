import { Router } from 'express';
import { asyncHandler, ResponseHandler, ApiError, userAuthenticator } from '@ptk/shared';
import { dataSource } from '../../database/data-source';
import { User } from '../../database/models/user.entity';
import { UserRole } from '../../database/models/user-role.entity';
import { Role } from '../../database/models/role.entity';

const router = Router();

router.get(
  '/me',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const user = await dataSource.getRepository(User).findOne({ where: { id: u.userId } });
    if (!user) throw ApiError.notFound('User not found');
    return ResponseHandler.success(res, {
      id: user.id,
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      phone: user.Phone,
      tenantId: user.TenantId,
      branchId: user.BranchId,
      preferredLanguage: user.PreferredLanguage,
      profileImageUrl: user.ProfileImageUrl,
      themePrefs: user.ThemePrefs,
      roles: u.roles,
    });
  }),
);

router.patch(
  '/me',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const allowed = ['FirstName', 'LastName', 'Email', 'PreferredLanguage', 'ThemePrefs'] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    await dataSource.getRepository(User).update({ id: u.userId }, patch);
    const user = await dataSource.getRepository(User).findOneByOrFail({ id: u.userId });
    return ResponseHandler.success(res, { id: user.id });
  }),
);

router.get(
  '/me/lookup',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    // Internal helper used by sister services to map a userId to its roles.
    const rows = await dataSource
      .getRepository(UserRole)
      .createQueryBuilder('ur')
      .innerJoin(Role, 'r', 'r.id = ur."RoleId"')
      .select('r."Code"', 'code')
      .where('ur."UserId" = :uid', { uid: req.currentUser!.userId })
      .getRawMany<{ code: string }>();
    return ResponseHandler.success(res, { roles: rows.map((r) => r.code) });
  }),
);

export default router;
