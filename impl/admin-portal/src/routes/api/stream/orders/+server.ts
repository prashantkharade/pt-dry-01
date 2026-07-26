import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/////////////////////////////////////////////////////////////////////////
//  SSE proxy: browser -> portal -> orders-service.
//
//  The browser cannot talk to orders-service directly — it has no API key
//  and no bearer token (the session lives in an httpOnly cookie). So the
//  portal opens the upstream stream with its own credentials and pipes the
//  bytes through, exactly like every other backend call here.
//
//  This is a pass-through, not a parser: SSE framing is already a stream,
//  and re-serialising it would only add a place to get the framing wrong.
/////////////////////////////////////////////////////////////////////////

const ORDERS = process.env.ORDERS_SERVICE_URL ?? 'http://localhost:4003';
const API_KEY = process.env.API_KEY_ADMIN_PORTAL ?? 'admin-portal-dev-key';

export const GET: RequestHandler = async ({ locals, request }) => {
  const session = locals.sessionUser;
  if (!session) throw error(401, 'Not signed in');

  const upstream = await fetch(`${ORDERS}/api/v1/orders/stream`, {
    headers: {
      'x-api-key'   : API_KEY,
      Authorization : `Bearer ${session.accessToken}`,
      Accept        : 'text/event-stream',
    },
    //Without this the fetch is aborted when the client goes away, but the
    //upstream connection would linger — one leaked socket per closed tab.
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    throw error(upstream.status || 502, 'Could not open the live stream');
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type'     : 'text/event-stream',
      'Cache-Control'    : 'no-cache, no-transform',
      Connection         : 'keep-alive',
      //nginx buffers proxied responses by default, which holds events until
      //the buffer fills — i.e. it silently breaks SSE.
      'X-Accel-Buffering': 'no',
    },
  });
};
