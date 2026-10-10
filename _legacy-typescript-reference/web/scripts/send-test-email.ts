import 'dotenv/config';
import { sendEmail } from '../lib/mail';

async function sendTestEmail() {
  const testEmail = process.env.RESEND_TEST_EMAIL;
  if (!testEmail) throw new Error('Define RESEND_TEST_EMAIL en .env antes de correr este script.');

  const result = await sendEmail({
    to: testEmail,
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  if (result.success) {
    console.log('Email sent successfully!');
    console.log('Response:', result.data);
  } else {
    console.error('Error sending email:', result.error);
  }
}

sendTestEmail();
