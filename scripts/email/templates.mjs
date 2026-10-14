// Branded email templates for Firebase Auth (HTML with inline styles and tables, which work in Gmail, Outlook and Apple Mail).
// Firebase fills in %LINK%, %EMAIL%, %DISPLAY_NAME% and %NEW_EMAIL%.
import { writeFileSync } from 'node:fs'
// Run: node scripts/email/templates.mjs  -> writes templates.json and preview-*.html next to this file.
process.chdir(new URL('.', import.meta.url).pathname)
const NAVY = '#0e2a44', MUTED = '#5b7690', BG = '#f3f8fd'
const LOGO = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
  <td style="width:40px;height:40px;border-radius:11px;background:#ffffff;text-align:center;vertical-align:middle;color:#2a74d6;font:800 22px/40px Arial,Helvetica,sans-serif">A</td>
  <td style="padding-left:10px;font:700 22px Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.3px">Aerelle</td></tr></table>`
function email({ preheader, title, intro, button, after, note }) {
  return `<div style="margin:0;padding:0;background:${BG}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2ecf6">
  <tr><td style="background:#2a74d6;background-image:linear-gradient(115deg,#0e93a8 0%,#2a74d6 52%,#5f4fd9 100%);padding:28px 24px;text-align:center">${LOGO}</td></tr>
  <tr><td style="padding:34px 32px 8px;font-family:Arial,Helvetica,sans-serif">
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:${NAVY};font-weight:700">${title}</h1>
    <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#33506b">${intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr>
      <td style="border-radius:12px;background:#2a74d6;background-image:linear-gradient(115deg,#0e93a8,#2a74d6 52%,#5f4fd9)">
        <a href="%LINK%" style="display:inline-block;padding:14px 28px;font:700 16px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:12px">${button}</a></td></tr></table>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${MUTED}">${after}</p>
  </td></tr>
  <tr><td style="padding:0 32px 30px;font-family:Arial,Helvetica,sans-serif">
    <p style="margin:0;padding-top:18px;border-top:1px solid #e8eff6;font-size:12px;line-height:1.6;color:#8aa1b5">${note}<br>Button not working? Copy this link into your browser:<br><a href="%LINK%" style="color:#2a74d6;word-break:break-all">%LINK%</a></p>
  </td></tr>
</table>
<p style="margin:18px 0 0;font:12px Arial,Helvetica,sans-serif;color:#8aa1b5;text-align:center">Aerelle · Class booking for studios · <a href="https://aerelle.vercel.app" style="color:#8aa1b5">aerelle.vercel.app</a></p>
</td></tr></table></div>`
}
export const templates = {
  verifyEmailTemplate: {
    subject: 'Confirm your email for Aerelle',
    body: email({
      preheader: 'One tap to confirm your email and finish setting up your account.',
      title: 'Confirm your email',
      intro: 'Hi %DISPLAY_NAME%, welcome to Aerelle. Confirm that this is your email address to finish setting up your account.',
      button: 'Confirm my email',
      after: 'Confirming also links any bookings and packages a studio has already set up for you.',
      note: "Didn't create an Aerelle account? You can ignore this email.",
    }),
  },
  resetPasswordTemplate: {
    subject: 'Reset your Aerelle password',
    body: email({
      preheader: 'Choose a new password for your Aerelle account.',
      title: 'Reset your password',
      intro: 'We received a request to reset the password for <strong style="color:#0e2a44">%EMAIL%</strong>. Tap the button to choose a new one.',
      button: 'Choose a new password',
      after: 'If a studio added you and this is your first time here, this is also how you set your password.',
      note: "Didn't ask to reset your password? You can ignore this email; your password stays the same.",
    }),
  },
  changeEmailTemplate: {
    subject: 'Your Aerelle sign-in email was changed',
    body: email({
      preheader: 'Your sign-in email was changed.',
      title: 'Your sign-in email changed',
      intro: 'Hi %DISPLAY_NAME%, the sign-in email for your Aerelle account was changed to <strong style="color:#0e2a44">%NEW_EMAIL%</strong>.',
      button: 'Undo this change',
      after: 'If you made this change, there is nothing else to do.',
      note: "If you didn't change it, use the button above to restore your original email and secure your account.",
    }),
  },
}
for (const [k, t] of Object.entries(templates)) {
  const sample = t.body.replaceAll('%LINK%', 'https://aerelle.vercel.app/auth-action?mode=…').replaceAll('%DISPLAY_NAME%', 'Nadia').replaceAll('%EMAIL%', 'nadia@example.com').replaceAll('%NEW_EMAIL%', 'nadia.new@example.com')
  writeFileSync(`preview-${k}.html`, `<!doctype html><meta charset="utf-8"><body style="margin:0">${sample}</body>`)
}
writeFileSync('templates.json', JSON.stringify(templates))
