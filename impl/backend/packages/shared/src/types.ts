export interface SessionUser {
  userId: string;
  tenantId: string;
  branchId?: string;
  sessionId: string;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: SessionUser;
      correlationId?: string;
      clientApp?: string;
    }
  }
}

export {};
