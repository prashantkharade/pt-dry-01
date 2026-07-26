/////////////////////////////////////////////////////////////////////////
//  Notification templates.
//
//  Every code exists in BOTH en and mr for every channel it supports.
//  That is a hard rule: renderTemplate() looks up (Code, Channel, Language)
//  and throws when it misses, so a Marathi-preferring customer hitting a
//  gap would get no notification at all rather than an English one.
//  There is a test that enumerates these and fails on any gap.
//
//  Variables are {{Name}} and substituted globally. Keep them short — SMS
//  is billed per 160 chars and Devanagari encodes as UCS-2, which halves
//  the budget to 70 characters per segment.
/////////////////////////////////////////////////////////////////////////

export interface TemplateSeed {
    Code     : string;
    Channel  : 'SMS' | 'Email' | 'Push' | 'WhatsApp' | 'InApp';
    Language : 'en' | 'mr';
    Subject? : string;
    Body     : string;
}

//Shared HTML shell so every mail looks like the same business.
const emailShell = (heading: string, inner: string): string => `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <div style="background:#0f4c5c;color:#fff;padding:20px 24px">
    <h1 style="margin:0;font-size:18px;font-weight:600">PT Kharade Drycleaners &amp; Laundry</h1>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:0">
    <h2 style="margin:0 0 12px;font-size:16px">${heading}</h2>
    ${inner}
  </div>
  <div style="padding:16px 24px;color:#6b7280;font-size:12px;text-align:center">
    PT Kharade Group of Industries &middot; Mukundnagar, Pune
  </div>
</div>`.trim();

/**
 * The WhatsApp receipt.
 *
 * Plain text, not HTML — WhatsApp renders *bold* with single asterisks and
 * ignores markup. This is the body we send inside the 24h window; outside it,
 * an approved Meta template with the same shape is used instead (see
 * WHATSAPP_TEMPLATE_MAP), because Meta rejects free-form after 24h.
 */
const waReceipt = (): string => [
    '*PT Kharade Drycleaners & Laundry*',
    '',
    'Hello {{Name}}, we have your order.',
    '',
    '*Order:* {{OrderCode}}',
    '*Service:* {{ServiceType}}',
    '*Items:* {{ItemCount}}',
    '*Total:* Rs.{{Total}}',
    '',
    '{{LegLine}}',
    '',
    'Track it here: {{TrackUrl}}',
    'Receipt: {{ReceiptUrl}}',
].join('\n');

const waReceiptMr = (): string => [
    '*PT Kharade Drycleaners & Laundry*',
    '',
    'नमस्कार {{Name}}, तुमची ऑर्डर मिळाली.',
    '',
    '*ऑर्डर:* {{OrderCode}}',
    '*सेवा:* {{ServiceType}}',
    '*वस्तू:* {{ItemCount}}',
    '*एकूण:* रु.{{Total}}',
    '',
    '{{LegLine}}',
    '',
    'ट्रॅक करा: {{TrackUrl}}',
    'पावती: {{ReceiptUrl}}',
].join('\n');

export const TEMPLATES: TemplateSeed[] = [

    //  --- WhatsApp -------------------------------------------------------
    //  The itemised receipt the customer actually keeps. Sent on every order,
    //  whether booked in the app or taken at the counter.
    { Code: 'ORDER_BOOKED', Channel: 'WhatsApp', Language: 'en', Body: waReceipt() },
    { Code: 'ORDER_BOOKED', Channel: 'WhatsApp', Language: 'mr', Body: waReceiptMr() },

    { Code: 'ORDER_READY', Channel: 'WhatsApp', Language: 'en',
      Body: '*PT Kharade*\n\nOrder *{{OrderCode}}* is ready for {{Mode}}.\n\nReceipt: {{ReceiptUrl}}' },
    { Code: 'ORDER_READY', Channel: 'WhatsApp', Language: 'mr',
      Body: '*PT Kharade*\n\nऑर्डर *{{OrderCode}}* {{Mode}} साठी तयार आहे.\n\nपावती: {{ReceiptUrl}}' },

    { Code: 'OUT_FOR_DELIVERY', Channel: 'WhatsApp', Language: 'en',
      Body: '*PT Kharade*\n\n{{PartnerName}} is bringing order *{{OrderCode}}* to you.\nContact: {{PartnerPhone}}\n\nTrack: {{TrackUrl}}' },
    { Code: 'OUT_FOR_DELIVERY', Channel: 'WhatsApp', Language: 'mr',
      Body: '*PT Kharade*\n\n{{PartnerName}} ऑर्डर *{{OrderCode}}* आणत आहेत.\nसंपर्क: {{PartnerPhone}}\n\nट्रॅक करा: {{TrackUrl}}' },

    { Code: 'ORDER_DELIVERED', Channel: 'WhatsApp', Language: 'en',
      Body: '*PT Kharade*\n\nOrder *{{OrderCode}}* delivered. Thank you!\n\nReceipt: {{ReceiptUrl}}' },
    { Code: 'ORDER_DELIVERED', Channel: 'WhatsApp', Language: 'mr',
      Body: '*PT Kharade*\n\nऑर्डर *{{OrderCode}}* पोहोचली. धन्यवाद!\n\nपावती: {{ReceiptUrl}}' },

    //  No {{ReceiptUrl}} here: payments-service sends this, and the signed
    //  order-receipt link is built in orders-service. The itemised receipt
    //  already went out with ORDER_BOOKED; this just confirms the money.
    { Code: 'PAYMENT_RECEIVED', Channel: 'WhatsApp', Language: 'en',
      Body: '*PT Kharade*\n\nPayment of *Rs.{{Amount}}* received for order {{OrderCode}} via {{Method}}. Thank you!' },
    { Code: 'PAYMENT_RECEIVED', Channel: 'WhatsApp', Language: 'mr',
      Body: '*PT Kharade*\n\nऑर्डर {{OrderCode}} साठी {{Method}} द्वारे *रु.{{Amount}}* मिळाले. धन्यवाद!' },


    //  --- Login OTP ------------------------------------------------------
    { Code: 'OTP_LOGIN', Channel: 'SMS', Language: 'en',
      Body: 'Your PT Kharade OTP is {{Otp}}. Valid {{Minutes}} minutes. Do not share it.' },
    { Code: 'OTP_LOGIN', Channel: 'SMS', Language: 'mr',
      Body: 'तुमचा PT Kharade OTP {{Otp}} आहे. {{Minutes}} मिनिटे वैध. शेअर करू नका.' },

    //  --- Order booked ---------------------------------------------------
    { Code: 'ORDER_BOOKED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Order {{OrderCode}} booked. Total Rs.{{Total}}.' },
    { Code: 'ORDER_BOOKED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: ऑर्डर {{OrderCode}} बुक झाली. एकूण रु.{{Total}}.' },
    { Code: 'ORDER_BOOKED', Channel: 'Push', Language: 'en',
      Subject: 'Order confirmed', Body: 'Order {{OrderCode}} is booked. Total Rs.{{Total}}.' },
    { Code: 'ORDER_BOOKED', Channel: 'Push', Language: 'mr',
      Subject: 'ऑर्डर निश्चित', Body: 'ऑर्डर {{OrderCode}} बुक झाली. एकूण रु.{{Total}}.' },
    { Code: 'ORDER_BOOKED', Channel: 'Email', Language: 'en',
      Subject: 'Your PT Kharade order {{OrderCode}}',
      Body: emailShell('Thank you, {{Name}}', `
        <p>We have booked your order <strong>{{OrderCode}}</strong>.</p>
        <p style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:6px">
          Total: <strong>Rs.{{Total}}</strong><br/>Service: {{ServiceType}}
        </p>
        <p>We will let you know as soon as it is ready.</p>`) },
    { Code: 'ORDER_BOOKED', Channel: 'Email', Language: 'mr',
      Subject: 'तुमची PT Kharade ऑर्डर {{OrderCode}}',
      Body: emailShell('धन्यवाद, {{Name}}', `
        <p>आम्ही तुमची ऑर्डर <strong>{{OrderCode}}</strong> बुक केली आहे.</p>
        <p style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:6px">
          एकूण: <strong>रु.{{Total}}</strong><br/>सेवा: {{ServiceType}}
        </p>
        <p>तयार होताच आम्ही तुम्हाला कळवू.</p>`) },

    //  --- Pickup leg -----------------------------------------------------
    { Code: 'PICKUP_SCHEDULED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Pickup for {{OrderCode}} scheduled {{Date}}, {{Slot}}.' },
    { Code: 'PICKUP_SCHEDULED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} साठी पिकअप {{Date}}, {{Slot}} ला नियोजित.' },
    { Code: 'PICKUP_SCHEDULED', Channel: 'Push', Language: 'en',
      Subject: 'Pickup scheduled', Body: '{{Date}} between {{Slot}} for order {{OrderCode}}.' },
    { Code: 'PICKUP_SCHEDULED', Channel: 'Push', Language: 'mr',
      Subject: 'पिकअप नियोजित', Body: 'ऑर्डर {{OrderCode}} साठी {{Date}}, {{Slot}}.' },

    //Partner is on the way — the one customers actually want.
    { Code: 'PICKUP_ON_THE_WAY', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: {{PartnerName}} is on the way to collect {{OrderCode}}. {{PartnerPhone}}' },
    { Code: 'PICKUP_ON_THE_WAY', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{PartnerName}} {{OrderCode}} घेण्यासाठी येत आहेत. {{PartnerPhone}}' },
    { Code: 'PICKUP_ON_THE_WAY', Channel: 'Push', Language: 'en',
      Subject: 'Our partner is on the way', Body: '{{PartnerName}} is coming to collect order {{OrderCode}}.' },
    { Code: 'PICKUP_ON_THE_WAY', Channel: 'Push', Language: 'mr',
      Subject: 'आमचे सहकारी येत आहेत', Body: '{{PartnerName}} ऑर्डर {{OrderCode}} घेण्यासाठी येत आहेत.' },

    { Code: 'PICKUP_DONE', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Collected {{ItemCount}} item(s) for {{OrderCode}}. Processing now.' },
    { Code: 'PICKUP_DONE', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} साठी {{ItemCount}} वस्तू घेतल्या. प्रक्रिया सुरू.' },
    { Code: 'PICKUP_DONE', Channel: 'Push', Language: 'en',
      Subject: 'Items collected', Body: 'We have {{ItemCount}} item(s) for order {{OrderCode}}.' },
    { Code: 'PICKUP_DONE', Channel: 'Push', Language: 'mr',
      Subject: 'वस्तू घेतल्या', Body: 'ऑर्डर {{OrderCode}} साठी {{ItemCount}} वस्तू मिळाल्या.' },

    //  --- Ready / delivery leg -------------------------------------------
    { Code: 'ORDER_READY', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Order {{OrderCode}} is ready for {{Mode}}.' },
    { Code: 'ORDER_READY', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: ऑर्डर {{OrderCode}} {{Mode}} साठी तयार आहे.' },
    { Code: 'ORDER_READY', Channel: 'Push', Language: 'en',
      Subject: 'Your order is ready', Body: 'Order {{OrderCode}} is ready for {{Mode}}.' },
    { Code: 'ORDER_READY', Channel: 'Push', Language: 'mr',
      Subject: 'तुमची ऑर्डर तयार आहे', Body: 'ऑर्डर {{OrderCode}} {{Mode}} साठी तयार आहे.' },

    { Code: 'OUT_FOR_DELIVERY', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: {{OrderCode}} is out for delivery with {{PartnerName}}. {{PartnerPhone}}' },
    { Code: 'OUT_FOR_DELIVERY', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} {{PartnerName}} सोबत डिलिव्हरीसाठी निघाली. {{PartnerPhone}}' },
    { Code: 'OUT_FOR_DELIVERY', Channel: 'Push', Language: 'en',
      Subject: 'Out for delivery', Body: '{{PartnerName}} is bringing order {{OrderCode}} to you.' },
    { Code: 'OUT_FOR_DELIVERY', Channel: 'Push', Language: 'mr',
      Subject: 'डिलिव्हरीसाठी निघाले', Body: '{{PartnerName}} ऑर्डर {{OrderCode}} आणत आहेत.' },

    { Code: 'ORDER_DELIVERED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Order {{OrderCode}} delivered. Thank you!' },
    { Code: 'ORDER_DELIVERED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: ऑर्डर {{OrderCode}} पोहोचली. धन्यवाद!' },
    { Code: 'ORDER_DELIVERED', Channel: 'Push', Language: 'en',
      Subject: 'Delivered', Body: 'Order {{OrderCode}} has been delivered. Thank you!' },
    { Code: 'ORDER_DELIVERED', Channel: 'Push', Language: 'mr',
      Subject: 'पोहोचली', Body: 'ऑर्डर {{OrderCode}} पोहोचली आहे. धन्यवाद!' },

    //  --- Delivery attempt failed ----------------------------------------
    { Code: 'DELIVERY_FAILED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: We could not deliver {{OrderCode}} ({{Reason}}). We will retry.' },
    { Code: 'DELIVERY_FAILED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} पोहोचवता आली नाही ({{Reason}}). पुन्हा प्रयत्न करू.' },
    { Code: 'DELIVERY_FAILED', Channel: 'Push', Language: 'en',
      Subject: 'Delivery attempt failed', Body: 'We could not deliver {{OrderCode}}: {{Reason}}' },
    { Code: 'DELIVERY_FAILED', Channel: 'Push', Language: 'mr',
      Subject: 'डिलिव्हरी अयशस्वी', Body: '{{OrderCode}} पोहोचवता आली नाही: {{Reason}}' },

    //  --- Payments -------------------------------------------------------
    { Code: 'PAYMENT_RECEIVED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Payment of Rs.{{Amount}} received for {{OrderCode}}. Thank you.' },
    { Code: 'PAYMENT_RECEIVED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} साठी रु.{{Amount}} मिळाले. धन्यवाद.' },
    { Code: 'PAYMENT_RECEIVED', Channel: 'Push', Language: 'en',
      Subject: 'Payment received', Body: 'Rs.{{Amount}} received for order {{OrderCode}}.' },
    { Code: 'PAYMENT_RECEIVED', Channel: 'Push', Language: 'mr',
      Subject: 'पेमेंट मिळाले', Body: 'ऑर्डर {{OrderCode}} साठी रु.{{Amount}} मिळाले.' },
    { Code: 'PAYMENT_RECEIVED', Channel: 'Email', Language: 'en',
      Subject: 'Receipt for order {{OrderCode}}',
      Body: emailShell('Payment received', `
        <p>Hello {{Name}}, we have received your payment.</p>
        <p style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:6px">
          Order: <strong>{{OrderCode}}</strong><br/>Amount: <strong>Rs.{{Amount}}</strong><br/>Method: {{Method}}
        </p>`) },
    { Code: 'PAYMENT_RECEIVED', Channel: 'Email', Language: 'mr',
      Subject: 'ऑर्डर {{OrderCode}} ची पावती',
      Body: emailShell('पेमेंट मिळाले', `
        <p>नमस्कार {{Name}}, तुमचे पेमेंट मिळाले आहे.</p>
        <p style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:6px">
          ऑर्डर: <strong>{{OrderCode}}</strong><br/>रक्कम: <strong>रु.{{Amount}}</strong><br/>पद्धत: {{Method}}
        </p>`) },

    { Code: 'PAYMENT_FAILED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Payment for {{OrderCode}} failed. Please try again.' },
    { Code: 'PAYMENT_FAILED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} चे पेमेंट अयशस्वी. कृपया पुन्हा प्रयत्न करा.' },
    { Code: 'PAYMENT_FAILED', Channel: 'Push', Language: 'en',
      Subject: 'Payment failed', Body: 'Payment for order {{OrderCode}} did not go through.' },
    { Code: 'PAYMENT_FAILED', Channel: 'Push', Language: 'mr',
      Subject: 'पेमेंट अयशस्वी', Body: 'ऑर्डर {{OrderCode}} चे पेमेंट झाले नाही.' },

    { Code: 'REFUND_PROCESSED', Channel: 'SMS', Language: 'en',
      Body: 'PT Kharade: Rs.{{Amount}} refunded for {{OrderCode}} to {{Destination}}.' },
    { Code: 'REFUND_PROCESSED', Channel: 'SMS', Language: 'mr',
      Body: 'PT Kharade: {{OrderCode}} साठी रु.{{Amount}} {{Destination}} मध्ये परत केले.' },
    { Code: 'REFUND_PROCESSED', Channel: 'Push', Language: 'en',
      Subject: 'Refund processed', Body: 'Rs.{{Amount}} refunded for order {{OrderCode}}.' },
    { Code: 'REFUND_PROCESSED', Channel: 'Push', Language: 'mr',
      Subject: 'परतावा झाला', Body: 'ऑर्डर {{OrderCode}} साठी रु.{{Amount}} परत केले.' },
];
