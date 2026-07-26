import { injectable } from 'tsyringe';
import { EntityManager } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { Wallet } from '../models/wallet.model';
import { WalletTransaction } from '../models/wallet.transaction.model';
import { BaseService } from './base.service';
import { ErrorHandler } from '../../../common/api.error';
import { logger } from '../../../logger/logger';
import { WalletTxnType, WalletTxnReason } from '../../../domain.types/enums/payment.enums';
import { Money } from '../../../common/utilities/money';

/////////////////////////////////////////////////////////////////////////
//  Store credit / B2B credit.
//
//  Three rules hold everything together:
//
//  1) The ledger is the truth. BalanceInr on the wallet is a cache, written
//     only inside the same transaction as its ledger row.
//  2) Every movement takes a row lock on the wallet first. Without it, two
//     concurrent debits both read the same balance and both pass the funds
//     check — the classic double-spend. Proven in wallet.service.test.ts.
//  3) All arithmetic is integer paise. Float rupees cannot represent 0.10,
//     and the error compounds across a ledger.
/////////////////////////////////////////////////////////////////////////

export interface MovementInput {
    TenantId        : string;
    CustomerId      : string;
    AmountInr       : number | string;
    Reason          : WalletTxnReason;
    OrderId?        : string;
    PaymentId?      : string;
    IdempotencyKey? : string;
    Description?    : string;
    CreatedBy?      : string;
}

@injectable()
export class WalletService extends BaseService {

    private _walletRepo = Source.getRepository(Wallet);
    private _txnRepo    = Source.getRepository(WalletTransaction);

    public getOrCreate = async (tenantId: string, customerId: string, manager?: EntityManager): Promise<Wallet> => {
        const repo = manager ? manager.getRepository(Wallet) : this._walletRepo;
        const found = await repo.findOne({ where: { TenantId: tenantId, CustomerId: customerId } });
        if (found) return found;
        try {
            return await repo.save(repo.create({ TenantId: tenantId, CustomerId: customerId }));
        } catch (error: any) {
            //Lost a race to create the same wallet. The unique constraint did
            //its job; just read the winner's row.
            if (error?.code === '23505') return repo.findOne({ where: { TenantId: tenantId, CustomerId: customerId } });
            throw error;
        }
    };

    public credit = async (input: MovementInput, manager?: EntityManager): Promise<WalletTransaction> =>
        this.move(WalletTxnType.Credit, input, manager);

    public debit = async (input: MovementInput, manager?: EntityManager): Promise<WalletTransaction> =>
        this.move(WalletTxnType.Debit, input, manager);

    private move = async (type: WalletTxnType, input: MovementInput, manager?: EntityManager): Promise<WalletTransaction> => {
        return manager
            ? this.moveWithin(manager, type, input)
            : Source.transaction((m) => this.moveWithin(m, type, input));
    };

    private moveWithin = async (
        manager: EntityManager, type: WalletTxnType, input: MovementInput,
    ): Promise<WalletTransaction> => {
        const paise = Money.toPaise(input.AmountInr);
        if (paise <= 0) ErrorHandler.throwInputValidationError(['Wallet amount must be greater than zero']);

        const wallet = await this.getOrCreate(input.TenantId, input.CustomerId, manager);

        //Lock the wallet row. Everything below reads a balance nobody else can
        //change until we commit.
        const locked = await manager.findOne(Wallet, { where: { id: wallet.id }, lock: { mode: 'pessimistic_write' } });
        if (!locked.IsActive) ErrorHandler.throwUnprocessableError('This wallet is inactive');

        //Idempotency inside the lock: a retry that already applied returns the
        //original row rather than moving money a second time.
        if (input.IdempotencyKey) {
            const prior = await manager.findOne(WalletTransaction, {
                where: { WalletId: locked.id, IdempotencyKey: input.IdempotencyKey },
            });
            if (prior) {
                logger.info(`Wallet movement ${input.IdempotencyKey} already applied — returning the original`);
                return prior;
            }
        }

        const beforePaise = Money.toPaise(locked.BalanceInr);
        const afterPaise  = type === WalletTxnType.Credit ? beforePaise + paise : beforePaise - paise;
        const floorPaise  = Money.toPaise(locked.MinBalanceInr);

        if (type === WalletTxnType.Debit && afterPaise < floorPaise) {
            //Retail: floor is 0, so this is "not enough balance".
            //B2B: floor is negative, so this is "credit limit reached".
            const available = Money.fromPaise(beforePaise - floorPaise);
            ErrorHandler.throwUnprocessableError(
                `Insufficient wallet balance: ${Money.fromPaise(paise)} requested, ${available} available`,
                { AvailableInr: available, RequestedInr: Money.fromPaise(paise) },
            );
        }

        locked.BalanceInr = Money.fromPaise(afterPaise);
        if (type === WalletTxnType.Credit) locked.TotalCreditedInr = Money.fromPaise(Money.toPaise(locked.TotalCreditedInr) + paise);
        else                               locked.TotalDebitedInr  = Money.fromPaise(Money.toPaise(locked.TotalDebitedInr) + paise);
        await manager.save(locked);

        const txn = await manager.save(manager.create(WalletTransaction, {
            TenantId         : input.TenantId,
            WalletId         : locked.id,
            Type             : type,
            Reason           : input.Reason,
            AmountInr        : Money.fromPaise(paise),
            BalanceBeforeInr : Money.fromPaise(beforePaise),
            BalanceAfterInr  : Money.fromPaise(afterPaise),
            OrderId          : input.OrderId ?? null,
            PaymentId        : input.PaymentId ?? null,
            IdempotencyKey   : input.IdempotencyKey ?? null,
            Description      : input.Description,
            CreatedBy        : input.CreatedBy ?? null,
        }));

        logger.info(`Wallet ${type} ${Money.fromPaise(paise)} customer=${input.CustomerId} ${Money.fromPaise(beforePaise)} -> ${Money.fromPaise(afterPaise)} (${input.Reason})`);
        return txn;
    };

    /** Spendable now — balance minus the floor (so B2B credit counts). */
    public spendable = async (tenantId: string, customerId: string): Promise<string> => {
        const wallet = await this.getOrCreate(tenantId, customerId);
        return Money.fromPaise(Money.toPaise(wallet.BalanceInr) - Money.toPaise(wallet.MinBalanceInr));
    };

    public getBalance = async (tenantId: string, customerId: string): Promise<Wallet> =>
        this.getOrCreate(tenantId, customerId);

    public history = async (tenantId: string, customerId: string, limit = 50): Promise<WalletTransaction[]> => {
        const wallet = await this.getOrCreate(tenantId, customerId);
        return this._txnRepo.find({ where: { WalletId: wallet.id }, order: { CreatedAt: 'DESC' }, take: limit });
    };

    /** Set a B2B credit limit — stored as a negative floor. */
    public setCreditLimit = async (tenantId: string, customerId: string, creditLimitInr: number): Promise<Wallet> => {
        if (creditLimitInr < 0) ErrorHandler.throwInputValidationError(['Credit limit cannot be negative']);
        const wallet = await this.getOrCreate(tenantId, customerId);
        wallet.MinBalanceInr = Money.fromPaise(-Money.toPaise(creditLimitInr));
        return this._walletRepo.save(wallet);
    };

    /**
     * Re-derive the balance from the ledger and report any drift.
     *
     * The cached balance should never disagree with the ledger — but "should
     * never" is exactly the kind of claim worth checking on a schedule, since
     * silent drift in a money column is very expensive to discover late.
     */
    public reconcile = async (tenantId: string, customerId: string): Promise<{ Cached: string; Derived: string; Drift: string }> => {
        const wallet = await this.getOrCreate(tenantId, customerId);
        const txns   = await this._txnRepo.find({ where: { WalletId: wallet.id }, order: { CreatedAt: 'ASC' } });

        let derivedPaise = 0;
        for (const t of txns) {
            const p = Money.toPaise(t.AmountInr);
            derivedPaise += t.Type === WalletTxnType.Credit ? p : -p;
        }
        const cachedPaise = Money.toPaise(wallet.BalanceInr);
        const driftPaise  = cachedPaise - derivedPaise;
        if (driftPaise !== 0) {
            logger.error(`WALLET DRIFT customer=${customerId} cached=${Money.fromPaise(cachedPaise)} derived=${Money.fromPaise(derivedPaise)}`);
        }
        return {
            Cached : Money.fromPaise(cachedPaise),
            Derived: Money.fromPaise(derivedPaise),
            Drift  : Money.fromPaise(driftPaise),
        };
    };
}
