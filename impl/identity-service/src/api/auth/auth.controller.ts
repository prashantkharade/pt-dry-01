import express from 'express';
import { container } from 'tsyringe';
import { AuthService } from '../../database/typeorm/services/auth.service';
import { OtpService } from '../../database/typeorm/services/otp.service';
import { TenantService } from '../../database/typeorm/services/tenant.service';
import { AuthValidator } from './auth.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Controllers are thin: parse via validator → call service → respond.
//  Errors propagate to the global handler via ResponseHandler.handleError.
/////////////////////////////////////////////////////////////////////////

export class AuthController {

    private _authService = container.resolve(AuthService);
    private _otpService  = container.resolve(OtpService);
    private _tenants     = container.resolve(TenantService);

    public otpSend = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const model  = await AuthValidator.validateOtpSend(request);
            //Pre-auth route: no token, so there is no tenant in scope. Resolve
            //the default tenant — the SMS template is tenant-scoped, and this
            //is a single-tenant deployment.
            const tenant = await this._tenants.getDefaultTenant();
            const language = (model.Language === 'mr' ? 'mr' : 'en') as 'en' | 'mr';
            const result = await this._otpService.send(model.Phone, tenant.id, language);
            return ResponseHandler.success(request, response, 'OTP sent successfully', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public otpVerify = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const model = await AuthValidator.validateOtpVerify(request);
            await this._otpService.verify(model.Phone, model.Otp);
            const result = await this._authService.loginAfterOtp(model.Phone);
            return ResponseHandler.success(request, response, 'Login successful', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public passwordLogin = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const model  = await AuthValidator.validatePasswordLogin(request);
            const result = await this._authService.loginPassword(model.EmailOrPhone, model.Password);
            return ResponseHandler.success(request, response, 'Login successful', 200, result);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public logout = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u = request.currentUser;
            if (!u) ErrorHandler.throwUnauthorizedError();
            await this._authService.logout(u.UserId, u.SessionId);
            return ResponseHandler.success(request, response, 'Logged out', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
