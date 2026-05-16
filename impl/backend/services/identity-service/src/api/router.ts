import { Router } from 'express';
import authRoutes from './auth/auth.controller';
import usersRoutes from './users/users.controller';
import customersRoutes from './customers/customers.controller';

export const router = Router();
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/customers', customersRoutes);
