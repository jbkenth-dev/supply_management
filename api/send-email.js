// Vercel Serverless Function — sends transactional email via Brevo API.
// Awardspace blocks ALL outbound connections (SMTP + HTTPS), so email
// must be sent from Vercel which allows outbound HTTP.

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const { email, name, code, type, expiryMinutes } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const apiKey = process.env.SMTP_API_KEY;
  const fromEmail = process.env.SMTP_FROM_EMAIL || '';
  const fromName = process.env.SMTP_FROM_NAME || 'SFC-G Supply Management';

  if (!apiKey || !fromEmail) {
    return res.status(500).json({ success: false, message: 'Email service not configured.' });
  }

  const isResend = type === 'resend';
  const isPasswordReset = type === 'password-reset';
  const isEmailChange = type === 'email-change';
  const subject = isPasswordReset
    ? 'Reset Your Password — SFC-G Supply Management'
    : isEmailChange
    ? 'Verify Your New Email Address — SFC-G Supply Management'
    : 'Verify Your SFC-G Supply Management Account';
  const displayName = name || 'User';
  const resetExpiry = expiryMinutes || 10;

  const htmlBody = buildHtml(displayName, code, isResend, isPasswordReset, resetExpiry, isEmailChange);
  const textBody = buildText(displayName, code, isResend, isPasswordReset, resetExpiry, isEmailChange);

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email, name: displayName }],
        subject,
        htmlContent: htmlBody,
        textContent: textBody,
      }),
    });

    const body = await brevoRes.text();

    if (!brevoRes.ok) {
      console.error('Brevo API error:', brevoRes.status, body);
      return res.status(502).json({
        success: false,
        message: 'Email service returned an error. Please try again.',
      });
    }

    return res.status(200).json({ success: true, message: 'Verification code sent.' });
  } catch (err) {
    console.error('Email send failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to send email. Please try again.',
    });
  }
}

function buildHtml(displayName, code, isResend, isPasswordReset, resetExpiry, isEmailChange) {
  const expiry = resetExpiry || 10;
  let headerTitle, headerSubtitle, bodyText;
  if (isPasswordReset) {
    headerTitle = 'Password Reset';
    headerSubtitle = 'Password Reset';
    bodyText = 'We received a request to reset your password. Use the verification code below to proceed.';
  } else if (isEmailChange) {
    headerTitle = 'SFC-G Supply Management';
    headerSubtitle = 'Email Change Verification';
    bodyText = 'We received a request to change your email address. Use the verification code below to confirm this change.';
  } else if (isResend) {
    headerTitle = 'SFC-G Supply Management';
    headerSubtitle = 'Email Verification';
    bodyText = 'Here is your new verification code.';
  } else {
    headerTitle = 'SFC-G Supply Management';
    headerSubtitle = 'Email Verification';
    bodyText = 'Use the verification code below to complete your account registration.';
  }
  const year = parseInt(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date()), 10);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f5f0eb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#8B5E3C,#A0522D);padding:32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">SFC-G Supply Management</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${escapeHtml(headerSubtitle)}</p>
        </td></tr>
        <tr><td style="padding:40px 32px;text-align:center;">
          <p style="color:#5C4033;font-size:16px;margin:0 0 8px;">Hello ${escapeHtml(displayName)},</p>
          <p style="color:#5C4033;font-size:14px;margin:0 0 32px;line-height:1.6;">${bodyText}</p>
          <div style="background-color:#f5f0eb;border-radius:16px;padding:24px;margin:0 0 32px;">
            <p style="color:#8B5E3C;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
            <p style="color:#2D1810;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;font-family:'Courier New',monospace;">${escapeHtml(code)}</p>
          </div>
          <p style="color:#999;font-size:13px;margin:0 0 8px;">This code expires in <strong style="color:#A0522D;">${expiry} minutes</strong>.</p>
          <p style="color:#999;font-size:12px;margin:0;">${isEmailChange ? 'If you did not request an email change, please ignore this email. Your current email address will remain unchanged.' : 'If you did not request this code, please ignore this email.'}</p>
        </td></tr>
        <tr><td style="background-color:#f5f0eb;padding:20px 32px;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">&copy; ${year} SFC-G Supply Management System. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(displayName, code, isResend, isPasswordReset, resetExpiry, isEmailChange) {
  const expiry = resetExpiry || 10;
  let bodyText;
  if (isPasswordReset) {
    bodyText = 'We received a request to reset your password. Your verification code is';
  } else if (isEmailChange) {
    bodyText = 'We received a request to change your email address. Your verification code is';
  } else if (isResend) {
    bodyText = 'Here is your new verification code';
  } else {
    bodyText = 'Use the verification code below to complete your account registration';
  }

  const footer = isEmailChange
    ? 'If you did not request an email change, please ignore this email. Your current email address will remain unchanged.'
    : 'If you did not request this code, please ignore this email.';

  return `Hello ${displayName},\n\n${bodyText}: ${code}\n\nThis code expires in ${expiry} minutes.\n\n${footer}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
