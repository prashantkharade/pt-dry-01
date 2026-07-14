/////////////////////////////////////////////////////////////////////////
//  Seed payload sourced from BRIEF.md §2.3. Idempotent — Seeder upserts
//  by (TenantId, Code) for catalog and (TenantId, ItemId, ServiceCode,
//  IsVendorRate) for rate cards.
/////////////////////////////////////////////////////////////////////////

export const SERVICE_TYPES = [
    { Code: 'DRY_CLEAN' , Name: 'Dry Clean'              , NameMr: 'ड्राय क्लीन', SortOrder: 1 },
    { Code: 'LAUNDRY'   , Name: 'Laundry (Wash + Iron)'  , NameMr: 'धुलाई'       , SortOrder: 2 },
    { Code: 'PRESS_ONLY', Name: 'Press Only'             , NameMr: 'इस्त्री'      , SortOrder: 3 },
];

export const CATEGORIES = [
    { Code: 'SHIRTS_TOPS'   , Name: 'Shirts & Tops'          , NameMr: 'शर्ट आणि टॉप्स', SortOrder: 1 },
    { Code: 'BOTTOMS'       , Name: 'Pants & Bottoms'        , NameMr: 'पॅंट्स'         , SortOrder: 2 },
    { Code: 'TRADITIONAL'   , Name: 'Traditional Wear'       , NameMr: 'पारंपरिक'       , SortOrder: 3 },
    { Code: 'OUTERWEAR'     , Name: 'Jackets & Outerwear'    , NameMr: 'जॅकेट'          , SortOrder: 4 },
    { Code: 'HOME'          , Name: 'Home Linen'             , NameMr: 'घरगुती कापड'    , SortOrder: 5 },
    { Code: 'VENDOR_BULK'   , Name: 'Vendor / Bulk Items'    , NameMr: 'विक्रेता'       , SortOrder: 6 },
];

export const ITEMS: Array<{
    Code: string; Name: string; NameMr?: string; CategoryCode: string;
    ApplicableServices: string[]; DefaultUom?: string; IsVendorOnly?: boolean;
}> = [
    { Code: 'SHIRT'        , Name: 'Shirt'             , NameMr: 'शर्ट'        , CategoryCode: 'SHIRTS_TOPS', ApplicableServices: ['DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY'] },
    { Code: 'PANT'         , Name: 'Pant'              , NameMr: 'पॅंट'        , CategoryCode: 'BOTTOMS'    , ApplicableServices: ['DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY'] },
    { Code: 'KURTA'        , Name: 'Kurta'             , NameMr: 'कुर्ता'       , CategoryCode: 'TRADITIONAL', ApplicableServices: ['PRESS_ONLY', 'DRY_CLEAN'] },
    { Code: 'L_KURTA'      , Name: 'Ladies Kurta'      , NameMr: 'महिला कुर्ता' , CategoryCode: 'TRADITIONAL', ApplicableServices: ['PRESS_ONLY', 'DRY_CLEAN'] },
    { Code: 'SARI'         , Name: 'Sari'              , NameMr: 'साडी'        , CategoryCode: 'TRADITIONAL', ApplicableServices: ['DRY_CLEAN', 'PRESS_ONLY'] },
    { Code: 'JERKIN'       , Name: 'Jerkin / Jacket'   , NameMr: 'जॅकेट'        , CategoryCode: 'OUTERWEAR'  , ApplicableServices: ['DRY_CLEAN'] },
    { Code: 'TOWEL'        , Name: 'Towel'             , NameMr: 'टॉवेल'        , CategoryCode: 'HOME'       , ApplicableServices: ['DRY_CLEAN', 'LAUNDRY'] },
    { Code: 'BEDSHEET_S'   , Name: 'Bedsheet (Single)' , NameMr: 'चादर (सिंगल)' , CategoryCode: 'HOME'       , ApplicableServices: ['LAUNDRY'] },
    { Code: 'BEDSHEET_K'   , Name: 'Bedsheet (King)'   , NameMr: 'चादर (किंग)' , CategoryCode: 'HOME'        , ApplicableServices: ['LAUNDRY'] },
    { Code: 'PILLOW_COVER' , Name: 'Pillow Cover'      , CategoryCode: 'VENDOR_BULK', ApplicableServices: ['LAUNDRY']   , IsVendorOnly: true },
    { Code: 'CURTAIN'      , Name: 'Curtain'           , CategoryCode: 'VENDOR_BULK', ApplicableServices: ['DRY_CLEAN'] , DefaultUom: 'sqft', IsVendorOnly: true },
    { Code: 'SOFA_COVER'   , Name: 'Sofa Cover'        , CategoryCode: 'VENDOR_BULK', ApplicableServices: ['DRY_CLEAN'] , IsVendorOnly: true },
];

export const RATES: Array<{
    ItemCode: string; ServiceCode: string; Rate: number; Uom?: string; IsVendorRate?: boolean;
}> = [
    // Dry Clean (BRIEF §2.3)
    { ItemCode: 'SHIRT'  , ServiceCode: 'DRY_CLEAN' , Rate: 50  },
    { ItemCode: 'PANT'   , ServiceCode: 'DRY_CLEAN' , Rate: 50  },
    { ItemCode: 'KURTA'  , ServiceCode: 'DRY_CLEAN' , Rate: 80  },
    { ItemCode: 'L_KURTA', ServiceCode: 'DRY_CLEAN' , Rate: 90  },
    { ItemCode: 'JERKIN' , ServiceCode: 'DRY_CLEAN' , Rate: 120 },
    { ItemCode: 'TOWEL'  , ServiceCode: 'DRY_CLEAN' , Rate: 60  },
    { ItemCode: 'SARI'   , ServiceCode: 'DRY_CLEAN' , Rate: 120 },

    // Press Only (BRIEF §2.3)
    { ItemCode: 'SHIRT'  , ServiceCode: 'PRESS_ONLY', Rate: 10  },
    { ItemCode: 'PANT'   , ServiceCode: 'PRESS_ONLY', Rate: 10  },
    { ItemCode: 'KURTA'  , ServiceCode: 'PRESS_ONLY', Rate: 15  },
    { ItemCode: 'L_KURTA', ServiceCode: 'PRESS_ONLY', Rate: 20  },
    { ItemCode: 'SARI'   , ServiceCode: 'PRESS_ONLY', Rate: 40  },

    // Laundry — recommended schedule
    { ItemCode: 'SHIRT'     , ServiceCode: 'LAUNDRY', Rate: 30 },
    { ItemCode: 'PANT'      , ServiceCode: 'LAUNDRY', Rate: 35 },
    { ItemCode: 'TOWEL'     , ServiceCode: 'LAUNDRY', Rate: 25 },
    { ItemCode: 'BEDSHEET_S', ServiceCode: 'LAUNDRY', Rate: 60 },
    { ItemCode: 'BEDSHEET_K', ServiceCode: 'LAUNDRY', Rate: 90 },

    // Vendor / B2B
    { ItemCode: 'BEDSHEET_S'  , ServiceCode: 'LAUNDRY'  , Rate: 40  , IsVendorRate: true },
    { ItemCode: 'BEDSHEET_K'  , ServiceCode: 'LAUNDRY'  , Rate: 65  , IsVendorRate: true },
    { ItemCode: 'PILLOW_COVER', ServiceCode: 'LAUNDRY'  , Rate: 12  , IsVendorRate: true },
    { ItemCode: 'CURTAIN'     , ServiceCode: 'DRY_CLEAN', Rate: 18  , Uom: 'sqft', IsVendorRate: true },
    { ItemCode: 'SOFA_COVER'  , ServiceCode: 'DRY_CLEAN', Rate: 250 , IsVendorRate: true },
];

export const SURCHARGES = [
    { Key: 'HOME_DELIVERY_FLAT_INR', Value: '40', Unit: 'INR', Description: 'Home delivery surcharge (BRIEF §2.3)' },
    { Key: 'EXPRESS_PCT'           , Value: '25', Unit: 'PCT', Description: 'Express / same-day surcharge (BRIEF §2.3)' },
    { Key: 'GST_DEFAULT_PCT'       , Value: '0' , Unit: 'PCT', Description: 'GST default (off by default — BRIEF §2.3)' },
];

export const SUBSCRIPTION_PLANS = [
    { Code: 'PLAN_MONTHLY_C'  , Name: 'Customer — Monthly'    , Duration: 'Monthly'   , PlanType: 'Customer', DiscountPct: '5'  , FreePickupsPerMonth: 2 , PriceInr: '299'  },
    { Code: 'PLAN_QUARTERLY_C', Name: 'Customer — Quarterly'  , Duration: 'Quarterly' , PlanType: 'Customer', DiscountPct: '8'  , FreePickupsPerMonth: 4 , PriceInr: '799'  },
    { Code: 'PLAN_HALF_C'     , Name: 'Customer — Half-yearly', Duration: 'HalfYearly', PlanType: 'Customer', DiscountPct: '10' , FreePickupsPerMonth: 6 , PriceInr: '1499' },
    { Code: 'PLAN_YEARLY_C'   , Name: 'Customer — Yearly'     , Duration: 'Yearly'    , PlanType: 'Customer', DiscountPct: '12' , FreePickupsPerMonth: 8 , PriceInr: '2799' },
    { Code: 'PLAN_MONTHLY_V'  , Name: 'Vendor — Monthly'      , Duration: 'Monthly'   , PlanType: 'Vendor'  , DiscountPct: '10' , FreePickupsPerMonth: 8 , PriceInr: '999'  },
    { Code: 'PLAN_YEARLY_V'   , Name: 'Vendor — Yearly'       , Duration: 'Yearly'    , PlanType: 'Vendor'  , DiscountPct: '18' , FreePickupsPerMonth: 30, PriceInr: '9999' },
];
