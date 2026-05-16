import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler, ResponseHandler, ApiError, userAuthenticator } from '@ptk/shared';
import { OrdersService } from '../../services/orders.service';

const router = Router();

const itemSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  note: Joi.string().max(255).optional(),
});

const createSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  serviceTypeCode: Joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').required(),
  channel: Joi.string().valid('HomePickup', 'DropAtShop').required(),
  deliveryType: Joi.string().valid('HomeDelivery', 'CustomerPickup').required(),
  isExpress: Joi.boolean().default(false),
  billedTo: Joi.string().valid('Customer', 'Vendor').optional(),
  items: Joi.array().min(1).items(itemSchema).required(),
  scheduledAt: Joi.date().iso().optional(),
  deliveryAddressId: Joi.string().uuid().optional(),
  notes: Joi.string().max(2000).optional(),
});

router.post(
  '/',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist', 'Customer'] }),
  asyncHandler(async (req, res) => {
    const body = await createSchema.validateAsync(req.body, { abortEarly: false });
    const u = req.currentUser!;
    const auth = req.headers.authorization?.slice('Bearer '.length) ?? '';
    const order = await OrdersService.create(body, u.userId, auth);
    return ResponseHandler.created(res, order);
  }),
);

router.get(
  '/',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist'] }),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const result = await OrdersService.list(u.tenantId, {
      status: req.query.status as never,
      customerId: req.query.customerId as string | undefined,
      q: req.query.q as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    return ResponseHandler.success(res, result);
  }),
);

router.get(
  '/me',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    // For a Customer, look up by their user id → customer id via identity. For
    // simplicity (and because the slice's flow always uses customerId as path
    // in admin and as query for app), we accept ?customerId=... here as well.
    if (!req.query.customerId) throw ApiError.badRequest('Provide customerId');
    const result = await OrdersService.list(u.tenantId, {
      customerId: req.query.customerId as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    return ResponseHandler.success(res, result);
  }),
);

router.get(
  '/:id',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const u = req.currentUser!;
    const result = await OrdersService.detail(u.tenantId, req.params.id);
    return ResponseHandler.success(res, result);
  }),
);

router.patch(
  '/:id/status',
  userAuthenticator({ roles: ['SystemAdmin', 'Receptionist'] }),
  asyncHandler(async (req, res) => {
    const body = await Joi.object({
      status: Joi.string()
        .valid('Booked', 'PickedUp', 'Received', 'InProcess', 'Ready', 'OutForDelivery', 'Delivered', 'Closed', 'Cancelled', 'OnHold')
        .required(),
      note: Joi.string().max(255).optional(),
    }).validateAsync(req.body);
    const u = req.currentUser!;
    const order = await OrdersService.updateStatus(
      u.tenantId,
      req.params.id,
      body.status,
      u.userId,
      u.userId, // actor name would normally be looked up
      body.note,
    );
    return ResponseHandler.success(res, order);
  }),
);

export default router;
