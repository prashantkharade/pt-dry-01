import express from 'express';
import joi from 'joi';
import { UserUpdateModel, UserSearchFilters } from '../../domain.types/users/user.types';
import { ErrorHandler } from '../../common/api.error';

export class UserValidator {

    public static validateUpdateMe = async (request: express.Request): Promise<UserUpdateModel> => {
        try {
            const schema = joi.object({
                FirstName        : joi.string().max(128).optional(),
                LastName         : joi.string().max(128).optional(),
                Email            : joi.string().email().optional(),
                PreferredLanguage: joi.string().length(2).optional(),
                ProfileImageUrl  : joi.string().max(512).optional(),
                ThemePrefs       : joi.object().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateSearch = async (request: express.Request): Promise<UserSearchFilters> => {
        try {
            const schema = joi.object({
                BranchId    : joi.string().uuid().optional(),
                Phone       : joi.string().optional(),
                Email       : joi.string().email().optional(),
                NameLike    : joi.string().optional(),
                RoleCode    : joi.string().optional(),
                PageIndex   : joi.number().integer().min(0).optional(),
                ItemsPerPage: joi.number().integer().min(1).max(100).optional(),
            });
            return await schema.validateAsync(request.query, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
