-- Migration: Add signature_html to outreach_settings
-- TASK MACT #055: Master Email Signature Template

-- Add signature_html column
ALTER TABLE outreach_settings
ADD COLUMN IF NOT EXISTS signature_html TEXT DEFAULT '';

-- Update with Chris's signature
UPDATE outreach_settings SET signature_html = '<div style="font-family: Arial, sans-serif; margin-top: 30px; padding-top: 20px;">
  <p style="margin: 0 0 20px 0; color: #333;">Cheers,<br>Chris</p>

  <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
    <tr>
      <td style="background-color: #1a1a1a; padding: 25px; border-radius: 8px; width: 400px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-right: 20px; vertical-align: top; width: 130px;">
              <img src="https://mact.au/wp-content/uploads/mact-logo-white.png" alt="MACt" style="width: 120px;">
            </td>
            <td style="color: white; font-size: 13px; line-height: 1.6; vertical-align: top;">
              <strong style="font-size: 15px;">Chris Born</strong><br>
              <span style="color: #999;">Technical Director / Founder</span><br><br>
              Mobile 0405 606 234<br>
              Office 0466 334 630<br>
              <a href="mailto:c.born@mact.au" style="color: #00b4b4; text-decoration: none;">c.born@mact.au</a><br>
              Unit 3C, 919-925 Nudgee Road,<br>Banyo, QLD 4014
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;">
    <tr>
      <td>
        <a href="https://mact.au" style="color: #00b4b4; text-decoration: none; font-weight: bold; font-size: 14px;">mact.au</a>
      </td>
      <td style="padding-left: 15px;">
        <span style="background: #00b4b4; color: white; padding: 5px 12px; border-radius: 3px; font-size: 12px; margin-right: 5px;">GFRC</span>
        <span style="background: #00b4b4; color: white; padding: 5px 12px; border-radius: 3px; font-size: 12px; margin-right: 5px;">Mining</span>
        <span style="background: #00b4b4; color: white; padding: 5px 12px; border-radius: 3px; font-size: 12px; margin-right: 5px;">Admixtures</span>
        <span style="background: #00b4b4; color: white; padding: 5px 12px; border-radius: 3px; font-size: 12px; margin-right: 5px;">Concrete Chemicals</span>
        <span style="background: #00b4b4; color: white; padding: 5px 12px; border-radius: 3px; font-size: 12px;">Consulting</span>
      </td>
    </tr>
  </table>

  <p style="font-size: 10px; color: #999; margin-top: 20px; line-height: 1.4;">
    Copyright 2023 by Mining and Cement Technology Pty Ltd. All rights reserved. This email may contain privileged/confidential information intended for the addressee. Attached materials remain the exclusive property of Mining and Cement Technology Pty Ltd, potentially constituting legally protected intellectual property. If you are not the intended recipient or responsible for delivery, do not copy or distribute this email. If received in error, notify us by phone. Mining and Cement Technology Pty Ltd is not liable for unauthorized use. Company email traffic may be monitored. Thank you.
  </p>
</div>';

-- Update existing templates to remove manual signatures (signature now auto-appended)
UPDATE outreach_templates SET body = E'Hi {{first_name}},\n\nIt''s been a while since you grabbed that {{last_product}}. I''d love to know how that project turned out!\n\nStill working with GFRC? Happy to help if you need anything.'
WHERE name = 'Personal Check-in';

UPDATE outreach_templates SET body = E'Hi {{first_name}},\n\nIt''s been {{days_since_order}} days since your last order with us. I wanted to reach out personally to see how things are going.\n\nIf you''re planning any upcoming GFRC projects, I''ve set aside a 10% discount just for you. Just mention this email when you order.\n\nAny questions? Just hit reply — comes straight to me.'
WHERE name = 'Win-back with Offer';

UPDATE outreach_templates SET body = E'Hi {{first_name}},\n\nI just wanted to reach out personally to say thanks. You''ve spent {{total_spent}} with us over {{order_count}} orders — that makes you one of our most valued customers.\n\nIs there anything we could be doing better? Any products you''d like us to stock? I''d love to hear your thoughts.'
WHERE name = 'VIP Thank You';
