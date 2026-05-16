import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler, ResponseHandler, userAuthenticator } from '@ptk/shared';
import { PricingService } from '../../services/pricing.service';

const router = Router();

router.post(
  '/quote',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const body = await Joi.object({
      serviceTypeCode: Joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').required(),
      deliveryType: Joi.string().valid('HomeDelivery', 'CustomerPickup').required(),
      isExpress: Joi.boolean().default(false),
      isVendor: Joi.boolean().default(false),
      items: Joi.array()
        .min(1)
        .items(Joi.object({ itemId: Joi.string().uuid().required(), quantity: Joi.number().integer().min(1).required() }))
        .required(),
    }).validateAsync(req.body, { abortEarly: false });

    const quote = await PricingService.quote({
      tenantId: req.currentUser!.tenantId,
      serviceTypeCode: body.serviceTypeCode,
      isVendor: body.isVendor,
      isExpress: body.isExpress,
      deliveryType: body.deliveryType,
      items: body.items,
    });
    return ResponseHandler.success(res, quote);
  }),
);

export default router;
