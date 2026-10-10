import 'dotenv/config';
import { sendEmail } from '../lib/mail';
import path from 'path';

async function verifyResend() {
    console.log('--- Resend Verification Script ---');
    console.log('API KEY PREVIEW:', process.env.RESEND_API_KEY?.substring(0, 10) + '...');
    console.log('ENABLE_NOTIFICATIONS:', process.env.ENABLE_EMAIL_NOTIFICATIONS);

    const testEmail = process.env.RESEND_TEST_EMAIL; // AJUSTAR: define tu propio correo de prueba en .env
    if (!testEmail) throw new Error('Define RESEND_TEST_EMAIL en .env antes de correr este script.')
    const subject = '[PlentyPay] Test Verification Email';
    const html = `
    <h1>Resend Configuration Successful!</h1>
    <p>This is a test email to verify that the Resend integration is working correctly with the new utility.</p>
    <ul>
      <li><strong>Utility:</strong> lib/mail.ts</li>
      <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
    </ul>
  `;

    try {
        const result = await sendEmail({
            to: testEmail,
            subject,
            html,
        });

        if (result.success) {
            console.log('SUCCESS: Test email sent successfully.');
            console.log('Data:', result.data);
        } else {
            console.error('FAILED: Test email send failed.');
            console.error('Error:', result.error);
        }
    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
}

verifyResend();
