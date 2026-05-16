import type { SessionUser } from '$lib/session';

declare global {
  namespace App {
    interface Locals {
      sessionUser: SessionUser | null;
    }
    interface PageData {
      sessionUser?: SessionUser | null;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Platform {}
    interface Error {
      code?: string;
    }
  }
}

export {};
