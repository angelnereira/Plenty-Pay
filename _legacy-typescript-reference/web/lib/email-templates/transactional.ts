import { baseEmailLayout, ctaButton, infoBanner } from './base';

/**
 * Plantillas para correos transaccionales (Registro, Password, etc.)
 * Estilo premium sin emojis, alineado con PlentyPay Dashboard.
 */

/** Correo de restablecimiento de contraseña */
export const passwordResetEmail = (resetUrl: string) => {
  const content = `
    <h1>Restablecer Contraseña</h1>
    <p>Hemos recibido una solicitud para cambiar la contraseña de tu cuenta de PlentyPay.</p>
    <p>Haz clic en el botón de abajo para elegir una nueva contraseña de forma segura. Este enlace expirará en 24 horas.</p>
    
    ${ctaButton('Cambiar Contraseña', resetUrl)}
    
    ${infoBanner(
      'Seguridad',
      'Si no has solicitado este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual no cambiará.'
    )}
    
    <p>Por seguridad, no compartas este enlace con nadie.</p>
  `;
  return baseEmailLayout(content, { 
    title: 'Restablecer Contraseña - PlentyPay',
    preheader: 'Usa este enlace para cambiar tu contraseña'
  });
};

/** Correo de verificación de cuenta nueva */
export const emailVerificationEmail = (verifyUrl: string, name: string) => {
  const content = `
    <h1>Verifica tu Correo</h1>
    <p>Hola <span class="accent-text">${name}</span>,</p>
    <p>Para activar tu cuenta y comenzar el proceso de registro en PlentyPay, necesitamos confirmar que tu dirección de correo es válida.</p>
    
    ${ctaButton('Verificar Cuenta', verifyUrl)}
    
    <div style="margin: 24px 0; padding: 20px; background-color: #111827; border-left: 4px solid #7C3AED; border-radius: 8px;">
        <p style="margin: 0; font-size: 13px; color: #F8FAFC; font-weight: 500;">
            Una vez verificado, nuestro equipo procederá con la revisión de tu empresa en un plazo de 24 a 48 horas laborales.
        </p>
    </div>
  `;
  return baseEmailLayout(content, { 
    title: 'Verifica tu cuenta - PlentyPay',
    preheader: 'Confirma tu correo electrónico para continuar'
  });
};

/** Notificación al usuario de que su registro fue recibido */
export const registrationReceivedEmail = (name: string) => {
  const content = `
    <h1>Registro en Revisión</h1>
    <p>Estimado/a <span class="accent-text">${name}</span>,</p>
    <p>Gracias por elegir PlentyPay. Hemos recibido tu solicitud de registro y tu correo ha sido verificado correctamente.</p>
    
    <p>Nuestro departamento administrativo está validando la información de tu empresa para garantizar el cumplimiento de las normativas de la DGI.</p>
    
    ${infoBanner(
      'Estado Actual',
      'Tu cuenta se encuentra en fase de validación. Recibirás un correo de confirmación una vez que el acceso sea aprobado.',
      'info'
    )}
  `;
  return baseEmailLayout(content, { title: 'Registro Recibido - PlentyPay' });
};

/** Notificación al admin sobre un nuevo registro verificado */
export const adminNewRegistrationEmail = (data: { name: string; email: string; companyName: string }) => {
  const content = `
    <h1 style="color: #8B5CF6;">Nuevo Registro Verificado</h1>
    <p>Un nuevo cliente ha verificado su correo y está pendiente de aprobación:</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; margin: 20px 0;">
        <tr>
            <td style="padding: 15px; background-color: #111827; border-bottom: 1px solid #1E293B;">
                <span style="font-size: 12px; color: #64748B; text-transform: uppercase;">Empresa</span><br>
                <strong style="color: #FFFFFF;">${data.companyName}</strong>
            </td>
        </tr>
        <tr>
            <td style="padding: 15px; background-color: #111827; border-bottom: 1px solid #1E293B;">
                <span style="font-size: 12px; color: #64748B; text-transform: uppercase;">Contacto</span><br>
                <strong style="color: #FFFFFF;">${data.name}</strong>
            </td>
        </tr>
        <tr>
            <td style="padding: 15px; background-color: #111827;">
                <span style="font-size: 12px; color: #64748B; text-transform: uppercase;">Email</span><br>
                <strong style="color: #FFFFFF;">${data.email}</strong>
            </td>
        </tr>
    </table>
    
    <p>Ingresa al panel de administración para revisar y aprobar esta cuenta.</p>
  `;
  return baseEmailLayout(content, { title: 'Nuevo registro verificado' });
};

/** Correo de cuenta aprobada y bienvenida */
export const accountApprovedEmail = (name: string, loginUrl: string) => {
  const content = `
    <h1 style="color: #10B981;">¡Cuenta Aprobada!</h1>
    <p>Bienvenido a PlentyPay, <span class="accent-text">${name}</span>.</p>
    <p>Tu infraestructura de facturación ya está configurada y lista para ser utilizada. Tu empresa ha sido validada para operar en nuestra plataforma.</p>
    
    ${ctaButton('Acceder a mi Panel', loginUrl)}
    
    ${infoBanner(
      'Siguiente Paso',
      'Configura tus folios fiscales o importa tus ítems de inventario para comenzar a facturar.',
      'success'
    )}
  `;
  return baseEmailLayout(content, { title: 'Cuenta Aprobada - Bienvenido a PlentyPay' });
};
