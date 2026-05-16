import { Router } from 'express';
import Joi from 'joi';
import { ILike } from 'typeorm';
import { asyncHandler, ResponseHandler, ApiError, userAuthenticator } from '@ptk/shared';
import { dataSource } from '../../database/data-source';
import { Customer, type CustomerType } from '../../database/models/customer.entity';
import { CustomerAddress } from '../../database/models/customer-address.entity';

const router = Router();

// Search/list customers — Receptionist and SystemAdmin.
router.get(
  '/',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist'] }),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const q = ((req.query.q as string) ?? '').trim();
    const repo = dataSource.getRepository(Customer);
    const where = q
      ? [
          { TenantId: u.tenantId, Name: ILike(`%${q}%`) },
          { TenantId: u.tenantId, Phone: ILike(`%${q}%`) },
          { TenantId: u.tenantId, CustomerCode: ILike(`%${q}%`) },
        ]
      : { TenantId: u.tenantId };
    const items = await repo.find({ where, take: 25, order: { CreatedAt: 'DESC' } });
    return ResponseHandler.success(res, { items });
  }),
);

router.post(
  '/',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist'] }),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const body = await Joi.object({
      Name: Joi.string().min(2).max(255).required(),
      Phone: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required(),
      Email: Joi.string().email().optional(),
      CustomerType: Joi.string().valid('Retail', 'Vendor').default('Retail'),
      BusinessName: Joi.string().max(255).optional(),
      Gstin: Joi.string().length(15).optional(),
      Address: Joi.object({
        Flat: Joi.string().max(64).optional(),
        Building: Joi.string().max(255).optional(),
        Society: Joi.string().max(255).optional(),
        Landmark: Joi.string().max(255).optional(),
        Area: Joi.string().max(128).optional(),
        City: Joi.string().max(128).required(),
        State: Joi.string().max(128).required(),
        Pincode: Joi.string().length(6).required(),
      }).optional(),
    }).validateAsync(req.body, { abortEarly: false });

    const existing = await dataSource.getRepository(Customer).findOne({
      where: { TenantId: u.tenantId, Phone: body.Phone },
    });
    if (existing) throw ApiError.conflict('A customer with this phone already exists', { id: existing.id });

    const code = `PTK-CUST-${String(Date.now()).slice(-6)}`;
    const customer = await dataSource.getRepository(Customer).save({
      TenantId: u.tenantId,
      BranchId: u.branchId!,
      CustomerCode: code,
      CustomerType: body.CustomerType as CustomerType,
      Name: body.Name,
      Phone: body.Phone,
      Email: body.Email,
      BusinessName: body.BusinessName,
      Gstin: body.Gstin,
    });

    if (body.Address) {
      await dataSource.getRepository(CustomerAddress).save({
        CustomerId: customer.id,
        Label: 'Home',
        Flat: body.Address.Flat,
        Building: body.Address.Building,
        Society: body.Address.Society,
        Landmark: body.Address.Landmark,
        Area: body.Address.Area,
        City: body.Address.City,
        State: body.Address.State,
        Pincode: body.Address.Pincode,
        IsDefault: true,
      });
    }

    return ResponseHandler.created(res, customer);
  }),
);

router.get(
  '/:id',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist'] }),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const customer = await dataSource.getRepository(Customer).findOne({
      where: { id: req.params.id, TenantId: u.tenantId },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    const addresses = await dataSource
      .getRepository(CustomerAddress)
      .find({ where: { CustomerId: customer.id }, order: { IsDefault: 'DESC', CreatedAt: 'DESC' } });
    return ResponseHandler.success(res, { ...customer, addresses });
  }),
);

// Internal endpoint for orders-service: look up customer by id (with addresses).
router.get(
  '/:id/internal',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const customer = await dataSource.getRepository(Customer).findOne({ where: { id: req.params.id } });
    if (!customer) throw ApiError.notFound('Customer not found');
    return ResponseHandler.success(res, customer);
  }),
);

export default router;
