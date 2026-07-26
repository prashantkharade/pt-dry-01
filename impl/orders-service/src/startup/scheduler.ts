import cron from 'node-cron';
import { container } from 'tsyringe';
import { logger } from '../logger/logger';
import { SlotBookingService } from '../database/typeorm/services/slot.booking.service';

export class Scheduler {
    private static _instance: Scheduler = null;
    public static instance(): Scheduler { return this._instance || (this._instance = new Scheduler()); }

    public schedule = async (): Promise<void> => {
        this.scheduleStaleReservationSweep();
        logger.info('Scheduler: orders-service cron jobs registered');
    };

    /**
     * Free slot seats held by reservations that never became orders.
     *
     * A customer who opens the booking screen, reserves a seat and then walks
     * away holds capacity indefinitely otherwise — the slot reports full while
     * nothing is actually booked into it.
     *
     * Every 5 minutes: often enough that a seat comes back quickly, cheap
     * enough that it is one indexed query over a small set.
     */
    private scheduleStaleReservationSweep = (): void => {
        cron.schedule('*/5 * * * *', async () => {
            try {
                const released = await container.resolve(SlotBookingService).releaseStaleReservations();
                if (released > 0) logger.info(`Stale reservation sweep released ${released} seat(s)`);
            } catch (error: any) {
                //Never let a sweep failure kill the process — the next run retries.
                logger.error(`Stale reservation sweep failed: ${error?.message}`);
            }
        });
    };
}
