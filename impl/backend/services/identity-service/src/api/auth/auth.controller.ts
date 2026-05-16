import { Router } from 'express';
import { asyncHandler, ResponseHandler, ApiError, userAuthenticator } from '@ptk/shared';
import { AuthValidator } from './auth.validator';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';

const router = Router();

router.post(
  '/otp/send',
  asyncHandler(async (req, res) => {
    const { phone } = await AuthValidator.validateOtpSend(req);
    const result = await OtpService.send(phone);
    return ResponseHandler.success(res, { sent: true, devOtp: result.devOtp });
  }),
);

router.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const { phone, otp } = await AuthValidator.validateOtpVerify(req);
    await OtpService.verify(phone, otp);
    const result = await AuthService.loginAfterOtp(phone);
    return ResponseHandler.success(res, result);
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { emailOrPhone, password } = await AuthValidator.validatePasswordLogin(req);
    const result = await AuthService.loginPassword(emailOrPhone, password);
    return ResponseHandler.success(res, result);
  }),
);

router.post(
  '/logout',
  userAuthenticator(),
  asyncHandler(async (req, res) => {
    const u = req.currentUser;
    if (!u) throw ApiError.unauthorized();
    await AuthService.logout(u.userId, u.sessionId);
    return ResponseHandler.success(res, { ok: true });
  }),
);

export default router;
