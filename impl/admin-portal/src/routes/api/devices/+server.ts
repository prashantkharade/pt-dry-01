import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Identity } from '$lib/server/backend';

/////////////////////////////////////////////////////////////////////////
//  BFF: register the browser's push token.
//
//  The browser can't call identity-service directly — it has no API key and
//  the session token lives in an httpOnly cookie. So the portal forwards the
//  registration with its own credentials, exactly like every other call.
/////////////////////////////////////////////////////////////////////////

export const POST: RequestHandler = async ({ locals, request }) => {
  const session = locals.sessionUser;
  if (!session) throw error(401, 'Not signed in');

  const body = await request.json();
  if (!body?.DeviceId || !body?.FcmToken) {
    throw error(400, 'DeviceId and FcmToken are required');
  }

  await Identity.registerDevice(session.accessToken, {
    DeviceId : String(body.DeviceId),
    FcmToken : String(body.FcmToken),
    Platform : 'Web',
    DeviceName: String(body.DeviceName ?? 'Browser'),
  });
  return json({ ok: true });
};
