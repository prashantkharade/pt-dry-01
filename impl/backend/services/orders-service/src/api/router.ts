import { Router } from 'express';
import catalog from './catalog/catalog.controller';
import pricing from './pricing/pricing.controller';
import orders from './orders/orders.controller';

export const router = Router();
router.use('/catalog', catalog);
router.use('/pricing', pricing);
router.use('/orders', orders);
