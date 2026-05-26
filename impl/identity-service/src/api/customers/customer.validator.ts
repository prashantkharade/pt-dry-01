import express from 'express';
import joi from 'joi';
import {
    CustomerCreateModel, CustomerUpdateModel, CustomerSearchFilters,
} from '../../domain.types/customers/customer.types';
import { ErrorHandler } from '../../common/api.error';

const PhoneSchema = joi.string().pattern(/^\+91[6-9]\d{9}$/).message('Phone must be +91XXXXXXXXXX');

const AddressSchema = joi.object({
    Flat     : joi.string().max(64).optional(),
    Building : joi.string().max(255).optional(),
    Society  : joi.string().max(255).optional(),
    Landmark : joi.string().max(255).optional(),
    Area     : joi.string().max(128).optional(),
    City     : joi.string().max(128).required(),
    State    : joi.string().max(128).required(),
    Pincode  : joi.string().length(6).required(),
});

export class CustomerValidator {

    public static validateCreate = async (request: express.Request): Promise<Omit<CustomerCreateModel, 'TenantId' | 'BranchId'>> => {
        try {
            const schema = joi.object({
                Name             : joi.string().min(2).max(255).required(),
                Phone            : PhoneSchema.required(),
                Email            : joi.string().email().optional(),
                CustomerType     : joi.string().valid('Retail', 'Vendor').default('Retail'),
                BusinessName     : joi.string().max(255).optional(),
                Gstin            : joi.string().length(15).optional(),
                PriceTier        : joi.string().max(32).optional(),
                CreditLimit      : joi.number().min(0).optional(),
                PaymentTermsDays : joi.number().integer().min(0).max(180).optional(),
                Address          : AddressSchema.optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateUpdate = async (request: express.Request): Promise<CustomerUpdateModel> => {
        try {
            const schema = joi.object({
                Name             : joi.string().min(2).max(255).optional(),
                Phone            : PhoneSchema.optional(),
                Email            : joi.string().email().optional(),
                CustomerType     : joi.string().valid('Retail', 'Vendor').optional(),
                BusinessName     : joi.string().max(255).optional(),
                Gstin            : joi.string().length(15).optional(),
                PriceTier        : joi.string().max(32).optional(),
                CreditLimit      : joi.number().min(0).optional(),
                PaymentTermsDays : joi.number().integer().min(0).max(180).optional(),
                IsBlocked        : joi.boolean().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateSearch = async (request: express.Request): Promise<CustomerSearchFilters> => {
        try {
            const schema = joi.object({
                Query        : joi.string().allow('').optional(),
                CustomerType : joi.string().valid('Retail', 'Vendor').optional(),
                BranchId     : joi.string().uuid().optional(),
                PageIndex    : joi.number().integer().min(0).optional(),
                ItemsPerPage : joi.number().integer().min(1).max(100).optional(),
            });
            return await schema.validateAsync(request.query, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
