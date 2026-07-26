import express from 'express';
import { DeliveryController } from './delivery.controller';
import { DeliveryAuth } from './delivery.auth';
import { context } from '../../auth/context.handler';

export const register = (app: express.Application): void => {
    const router     = express.Router();
    const controller = new DeliveryController();

    //  --- Slot booking (customer-facing) ---
    router.get   ('/slots/availability'   , ...context(DeliveryAuth.slotAvailability), controller.slotAvailability);
    router.post  ('/slots/reserve'        , ...context(DeliveryAuth.reserveSlot)     , controller.reserveSlot);
    router.delete('/slots/bookings/:id'   , ...context(DeliveryAuth.releaseSlot)     , controller.releaseSlot);

    //  --- Slot master data (admin) ---
    //  Registered after the more specific '/slots/...' paths above so none of
    //  them is swallowed by '/slots/:id'.
    router.get   ('/slots'                , ...context(DeliveryAuth.readGeography)   , controller.listSlots);
    router.post  ('/slots'                , ...context(DeliveryAuth.manageSlots)     , controller.createSlot);
    router.put   ('/slots/:id'            , ...context(DeliveryAuth.manageSlots)     , controller.updateSlot);

    //  --- Geography ---
    router.get   ('/zones'                , ...context(DeliveryAuth.readGeography)   , controller.listZones);
    router.post  ('/zones'                , ...context(DeliveryAuth.manageZones)     , controller.createZone);
    router.get   ('/societies'            , ...context(DeliveryAuth.readGeography)   , controller.listSocieties);
    router.post  ('/societies'            , ...context(DeliveryAuth.manageZones)     , controller.createSociety);

    //  --- Partners + rosters ---
    router.get   ('/partners'             , ...context(DeliveryAuth.viewBoard)       , controller.listPartners);
    router.post  ('/partners'             , ...context(DeliveryAuth.managePartners)  , controller.createPartner);
    router.post  ('/partners/roster'      , ...context(DeliveryAuth.managePartners)  , controller.rosterPartner);
    router.post  ('/partners/zone-coverage', ...context(DeliveryAuth.managePartners) , controller.assignZone);

    //  --- Ops boards ---
    router.get   ('/board'                , ...context(DeliveryAuth.viewBoard)       , controller.board);
    router.get   ('/unassigned'           , ...context(DeliveryAuth.viewBoard)       , controller.unassigned);
    router.post  ('/assign'               , ...context(DeliveryAuth.assign)          , controller.assign);
    router.post  ('/auto-assign'          , ...context(DeliveryAuth.assign)          , controller.autoAssign);

    //  --- Partner-facing ---
    router.get   ('/my-runs'              , ...context(DeliveryAuth.myRuns)          , controller.myRuns);
    router.put   ('/runs/:id/status'      , ...context(DeliveryAuth.transitionRun)   , controller.transitionRun);

    //  --- Pricing ---
    router.get   ('/charge-quote'         , ...context(DeliveryAuth.quoteCharge)     , controller.chargeQuote);

    app.use('/api/v1/delivery', router);
};
