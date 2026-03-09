/**
 * Payment Details HTML Block
 *
 * Generates an email-safe HTML block with payment options:
 * 1. Bpoint credit card payment link (with invoice ref)
 * 2. Bank transfer details (CBA)
 *
 * Appended to COD reminder emails after the body, before the signature.
 */

const BPOINT_BASE_URL = "https://www.bpoint.com.au/pay/MININGANDCEMENTT";

const BANK_DETAILS = {
  bank: "Commonwealth Bank of Australia",
  bsb: "064-131",
  account: "10592006",
  name: "Mining & Cement Technology Pty Ltd",
};

export function buildPaymentLink(invoiceNumber: string): string {
  if (!invoiceNumber) return BPOINT_BASE_URL;
  return `${BPOINT_BASE_URL}?ref=${encodeURIComponent(invoiceNumber)}`;
}

/**
 * Build the payment details HTML block for email.
 * Matches the style of the MACt tax invoice footer.
 */
export function buildPaymentBlock(options: {
  invoiceNumber: string;
  amountDue: number;
}): string {
  const { invoiceNumber, amountDue } = options;
  const paymentLink = buildPaymentLink(invoiceNumber);

  const formattedAmount = amountDue > 0
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountDue)
    : "";

  const amountLine = formattedAmount
    ? `<p style="margin: 0 0 15px 0; font-size: 16px;"><strong>Amount Due: ${formattedAmount}</strong></p>`
    : "";

  const refLine = invoiceNumber
    ? `<p style="margin: 0; font-size: 13px; color: #666;">Reference: ${invoiceNumber}</p>`
    : "";

  return `
<div style="margin: 25px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-family: 'Poppins', Arial, sans-serif;">
  ${amountLine}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
    <tr>
      <td style="vertical-align: top; padding-right: 20px; width: 50%;">
        <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">Pay by Credit Card</p>
        <a href="${paymentLink}" style="display: inline-block; background-color: #0f766e; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Pay Now</a>
        ${refLine}
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">1.5% surcharge applies to credit card payments</p>
      </td>
      <td style="vertical-align: top; width: 50%;">
        <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">Pay by Bank Transfer</p>
        <table style="font-size: 13px; color: #374151;" cellpadding="2" cellspacing="0">
          <tr><td style="color: #6b7280; padding-right: 8px;">Bank:</td><td>${BANK_DETAILS.bank}</td></tr>
          <tr><td style="color: #6b7280; padding-right: 8px;">BSB:</td><td>${BANK_DETAILS.bsb}</td></tr>
          <tr><td style="color: #6b7280; padding-right: 8px;">Account:</td><td>${BANK_DETAILS.account}</td></tr>
          <tr><td style="color: #6b7280; padding-right: 8px;">Name:</td><td>${BANK_DETAILS.name}</td></tr>
          ${invoiceNumber ? `<tr><td style="color: #6b7280; padding-right: 8px;">Reference:</td><td><strong>${invoiceNumber}</strong></td></tr>` : ""}
        </table>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">Please email remittance to accounts@mact.au</p>
      </td>
    </tr>
  </table>
</div>`.trim();
}
