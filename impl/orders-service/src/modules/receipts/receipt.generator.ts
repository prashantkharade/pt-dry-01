import PDFDocument from 'pdfkit';
import { injectable } from 'tsyringe';
import { OrderDto, OrderLineDto } from '../../domain.types/orders/order.types';
import { ConfigurationManager } from '../../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Order receipt / tax invoice (PDF).
//
//  pdfkit rather than HTML→PDF: a headless Chromium is ~300MB and a whole
//  process per render, for a one-page document with a fixed layout. This is
//  a stream, so the response starts before the document is finished and we
//  never hold the whole PDF in memory.
//
//  Money is printed from the STORED strings, never recomputed. The invoice
//  must say exactly what the order says — a receipt that disagrees with the
//  order total by a paisa is worse than no receipt.
/////////////////////////////////////////////////////////////////////////

//pdfkit's default fonts are WinAnsi and cannot render Devanagari. Marathi
//receipts need a Unicode font registered; until one is bundled we print the
//English layout rather than emitting boxes.
const RUPEE = 'Rs.';

const COLORS = {
    ink   : '#1a1a1a',
    muted : '#6b7280',
    brand : '#0f4c5c',
    line  : '#e5e7eb',
};

export interface ReceiptContext {
    Order      : OrderDto;
    Lines      : OrderLineDto[];
    //Printed on the invoice. Comes from config, not hardcoded, because a
    //GSTIN on an invoice is a legal identifier and belongs with the business
    //details rather than in code.
    BusinessName?: string;
    Gstin?     : string;
    AddressLine?: string;
    Phone?     : string;
    //Present once paid — turns a proforma into a receipt.
    PaidAmount?: string;
    PaidVia?   : string;
}

@injectable()
export class ReceiptGenerator {

    /**
     * Render to a stream.
     *
     * Returns the document so the caller can pipe it straight to the HTTP
     * response: a receipt is generated on demand and never stored, so there is
     * nothing to buffer or clean up.
     */
    public render = (ctx: ReceiptContext): PDFKit.PDFDocument => {
        const doc = new PDFDocument({ size: 'A4', margin: 48, info: {
            Title  : `Receipt ${ctx.Order.OrderCode}`,
            Author : ctx.BusinessName ?? 'PT Kharade Drycleaners & Laundry',
        } });

        this.header(doc, ctx);
        this.meta(doc, ctx);
        this.lines(doc, ctx);
        this.totals(doc, ctx);
        this.footer(doc, ctx);

        doc.end();
        return doc;
    };

    private header = (doc: PDFKit.PDFDocument, ctx: ReceiptContext): void => {
        const business = ctx.BusinessName ?? ConfigurationManager.getEnv('BUSINESS_NAME', 'PT Kharade Drycleaners & Laundry');

        doc.rect(0, 0, doc.page.width, 96).fill(COLORS.brand);
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
           .text(business, 48, 30, { width: doc.page.width - 96 });
        doc.fontSize(9).font('Helvetica')
           .text(ctx.AddressLine ?? ConfigurationManager.getEnv('BUSINESS_ADDRESS', 'Mukundnagar, Pune, Maharashtra 411037'), 48, 54);

        const phone = ctx.Phone ?? ConfigurationManager.getEnvOptional('BUSINESS_PHONE');
        const gstin = ctx.Gstin ?? ConfigurationManager.getEnvOptional('BUSINESS_GSTIN');
        const bits  = [phone && `Phone: ${phone}`, gstin && `GSTIN: ${gstin}`].filter(Boolean).join('   ');
        if (bits) doc.text(bits, 48, 68);

        doc.fillColor(COLORS.ink);
        doc.y = 120;
    };

    private meta = (doc: PDFKit.PDFDocument, ctx: ReceiptContext): void => {
        const o = ctx.Order;
        //A paid order gets a receipt; an unpaid one is only a proforma. Saying
        //"Receipt" on an unpaid order is a claim we haven't earned.
        const title = ctx.PaidAmount ? 'RECEIPT' : 'PROFORMA INVOICE';

        doc.fontSize(16).font('Helvetica-Bold').text(title, 48, doc.y);
        doc.moveDown(0.4);

        const left = 48;
        const right = doc.page.width / 2 + 10;
        const top = doc.y;

        doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
        doc.text('Order', left, top);
        doc.text('Date', left, top + 26);
        doc.text('Billed to', right, top);
        doc.text('Service', right, top + 26);

        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.ink);
        doc.text(o.OrderCode, left, top + 11);
        doc.text(new Date(o.CreatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), left, top + 37);
        doc.text(o.CustomerName, right, top + 11);
        doc.text(`${o.ServiceTypeCode}${o.IsExpress ? ' (Express)' : ''}`, right, top + 37);

        doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
        doc.text(o.CustomerPhone, right, top + 52);

        doc.fillColor(COLORS.ink);
        doc.y = top + 78;
    };

    private lines = (doc: PDFKit.PDFDocument, ctx: ReceiptContext): void => {
        const startY = doc.y;
        const cols = { item: 48, qty: 320, rate: 390, total: 470 };

        doc.rect(48, startY, doc.page.width - 96, 22).fill('#f3f4f6');
        doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold');
        doc.text('ITEM', cols.item + 6, startY + 7);
        doc.text('QTY', cols.qty, startY + 7);
        doc.text('RATE', cols.rate, startY + 7);
        doc.text('AMOUNT', cols.total, startY + 7, { width: 60, align: 'right' });

        let y = startY + 30;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink);

        for (const line of ctx.Lines) {
            //A long garment list must not run off the page — start a new one
            //and repeat nothing but the rows.
            if (y > doc.page.height - 200) {
                doc.addPage();
                y = 60;
            }
            doc.text(line.ItemName, cols.item + 6, y, { width: 260 });
            doc.text(String(line.Quantity), cols.qty, y);
            doc.text(`${RUPEE}${line.UnitRateInr}`, cols.rate, y);
            doc.text(`${RUPEE}${line.LineTotalInr}`, cols.total, y, { width: 60, align: 'right' });
            y += 20;
            doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(48, y - 5).lineTo(doc.page.width - 48, y - 5).stroke();
        }
        doc.y = y + 10;
    };

    private totals = (doc: PDFKit.PDFDocument, ctx: ReceiptContext): void => {
        const o = ctx.Order;
        const labelX = 350;
        const valueX = 470;
        let y = doc.y;

        //Only print a line that carries a value. A receipt listing
        //"Express charge Rs.0.00" on a non-express order is noise.
        const rows: Array<[string, string, boolean]> = [
            ['Subtotal',       o.SubtotalInr,       true],
            ['Delivery',       o.DeliveryChargeInr, Number(o.DeliveryChargeInr) > 0],
            ['Express charge', o.ExpressChargeInr,  Number(o.ExpressChargeInr) > 0],
            ['GST',            o.GstInr,            Number(o.GstInr) > 0],
        ];

        doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted);
        for (const [label, value, show] of rows) {
            if (!show) continue;
            doc.text(label, labelX, y);
            doc.fillColor(COLORS.ink).text(`${RUPEE}${value}`, valueX, y, { width: 60, align: 'right' });
            doc.fillColor(COLORS.muted);
            y += 18;
        }

        doc.strokeColor(COLORS.line).lineWidth(1).moveTo(labelX, y + 2).lineTo(doc.page.width - 48, y + 2).stroke();
        y += 10;

        doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.ink);
        doc.text('Total', labelX, y);
        doc.text(`${RUPEE}${o.TotalInr}`, valueX, y, { width: 60, align: 'right' });
        y += 24;

        if (ctx.PaidAmount) {
            doc.fontSize(10).font('Helvetica').fillColor('#059669');
            doc.text(`Paid${ctx.PaidVia ? ` via ${ctx.PaidVia}` : ''}`, labelX, y);
            doc.text(`${RUPEE}${ctx.PaidAmount}`, valueX, y, { width: 60, align: 'right' });
            y += 18;

            const due = Number(o.TotalInr) - Number(ctx.PaidAmount);
            if (due > 0.005) {
                doc.fillColor('#dc2626').font('Helvetica-Bold');
                doc.text('Balance due', labelX, y);
                doc.text(`${RUPEE}${due.toFixed(2)}`, valueX, y, { width: 60, align: 'right' });
                y += 18;
            }
        }
        doc.fillColor(COLORS.ink);
        doc.y = y + 20;
    };

    private footer = (doc: PDFKit.PDFDocument, ctx: ReceiptContext): void => {
        const y = Math.max(doc.y, doc.page.height - 120);
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);

        if (ctx.Order.Notes) {
            doc.text(`Note: ${ctx.Order.Notes}`, 48, y, { width: doc.page.width - 96 });
        }
        doc.text(
            'Thank you for your business. Garments not collected within 30 days are held at the customer\'s risk.',
            48, doc.page.height - 80, { width: doc.page.width - 96, align: 'center' },
        );
        doc.fontSize(8).text(
            //Says what it is. A computer-generated invoice with no signature
            //line should declare itself as such.
            'This is a computer-generated document and does not require a signature.',
            48, doc.page.height - 62, { width: doc.page.width - 96, align: 'center' },
        );
    };
}
