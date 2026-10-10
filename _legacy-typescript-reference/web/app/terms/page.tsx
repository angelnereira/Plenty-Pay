import { LandingNavbar, LandingFooter } from "@/components/landing"

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <LandingNavbar />
            <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
                <div className="bg-card rounded-2xl shadow-sm p-8 border border-border">
                    <h1 className="text-3xl font-bold text-foreground mb-6">
                        Términos y Condiciones de Uso
                    </h1>

                    <div className="prose dark:prose-invert max-w-none space-y-6 text-muted-foreground">
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                1. ACEPTACIÓN DE LOS TÉRMINOS
                            </h2>
                            <p>
                                Al registrarse y utilizar <strong>PlentyPay</strong> (en adelante, &ldquo;LA PLATAFORMA&rdquo;),
                                el CLIENTE (en adelante, &ldquo;EL USUARIO&rdquo; o &ldquo;EL EMISOR&rdquo;) acepta plenamente estos Términos
                                y Condiciones. Este acuerdo regula el uso del software como servicio (SaaS) para la
                                gestión y emisión de Factura Electrónica bajo la normativa de la República de Panamá.
                            </p>
                            <p className="mt-2">
                                Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestro servicio.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                2. DESCRIPCIÓN DEL SERVICIO Y ROL DE INTERMEDIARIO
                            </h2>
                            <p>
                                LA PLATAFORMA actúa como un <strong>proveedor de software intermediario</strong>.
                                Nuestra función se limita a:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Proporcionar la interfaz para la generación de documentos electrónicos conforme a la Ficha Técnica de la DGI.</li>
                                <li>Transmitir la información de manera segura al Proveedor de Autorización Calificado (PAC) integrado.</li>
                                <li>Almacenar y visualizar los comprobantes procesados en formato XML y PDF.</li>
                                <li>Generar el CAFE (Comprobante Auxiliar de Factura Electrónica) con código QR.</li>
                            </ul>

                            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                                <h3 className="font-semibold text-foreground mb-2">Aclaratoria de Roles:</h3>
                                <ul className="list-disc pl-6 space-y-1 text-sm">
                                    <li><strong>LA PLATAFORMA (PlentyPay):</strong> Software de gestión y emisión. No es un PAC ni una entidad gubernamental.</li>
                                    <li><strong>EL PAC (The Factory HKA):</strong> Entidad autorizada por la DGI para validar, autorizar y certificar los documentos electrónicos.</li>
                                    <li><strong>LA DGI:</strong> Dirección General de Ingresos, destinatario final de la información fiscal.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                3. REQUISITOS PREVIOS DEL USUARIO (EMISOR)
                            </h2>
                            <p>
                                Para utilizar el servicio, EL USUARIO declara y garantiza que:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Posee un <strong>RUC (Registro Único de Contribuyente) activo y válido</strong> en Panamá.</li>
                                <li>Ha realizado su registro ante el <strong>Sistema de Factura Electrónica de Panamá (SFEP)</strong> en la modalidad de Proveedor de Autorización Calificado (PAC).</li>
                                <li>Cuenta con una <strong>Firma Electrónica Calificada vigente</strong>, expedida por una entidad certificadora acreditada en Panamá (Registro Público u otra entidad autorizada), necesaria para firmar los XML antes del envío al PAC.</li>
                                <li>Es responsable de mantener la vigencia de dicha firma electrónica y renovarla antes de su vencimiento.</li>
                                <li>Tiene credenciales válidas para conectarse al PAC (The Factory HKA u otro proveedor integrado).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                4. INTEGRACIÓN CON EL PAC (PROVEEDOR DE AUTORIZACIÓN CALIFICADO)
                            </h2>
                            <p>
                                LA PLATAFORMA se conecta vía API/Web Services con el PAC para la validación y autorización de facturas electrónicas.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li><strong>Autorización:</strong> EL USUARIO autoriza expresamente a LA PLATAFORMA a enviar sus datos de facturación al PAC en su nombre para su validación y certificación.</li>
                                <li><strong>Tiempos de Respuesta:</strong> LA PLATAFORMA no se hace responsable por latencia, caídas, tiempos de inactividad o errores originados exclusivamente en los servidores del PAC o de la DGI.</li>
                                <li><strong>Rechazos:</strong> Si un documento es rechazado por el PAC o la DGI debido a inconsistencias fiscales (ej. RUC incorrecto, ITBMS mal calculado, datos de cliente erróneos), la responsabilidad de corrección recae completamente sobre EL USUARIO.</li>
                                <li><strong>Folios:</strong> Cada documento enviado al PAC (autorizado o rechazado) consumirá folios según la política del PAC y el plan contratado.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                5. RESPONSABILIDAD FISCAL Y LEGAL
                            </h2>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                                El uso de LA PLATAFORMA no exime a EL USUARIO de sus obligaciones tributarias.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li><strong>Veracidad de los Datos:</strong> EL USUARIO es el único responsable de la exactitud de los montos, impuestos (ITBMS, ISC), descripciones, datos del cliente final y cualquier otra información ingresada en el sistema.</li>
                                <li><strong>Cumplimiento Fiscal:</strong> EL USUARIO debe cumplir con todas las obligaciones establecidas por el Decreto Ejecutivo 25 de 2022 y sus modificaciones, incluyendo la emisión obligatoria de factura electrónica cuando corresponda.</li>
                                <li><strong>Contingencia:</strong> En caso de falla de los sistemas (Internet, PAC o DGI), EL USUARIO debe conocer y aplicar los protocolos de Factura de Contingencia establecidos por la normativa vigente (uso de papel preimpreso o facturación offline según aplique), liberando a LA PLATAFORMA de multas por no facturación inmediata.</li>
                                <li><strong>Almacenamiento Legal:</strong> Aunque LA PLATAFORMA almacena las facturas en la nube, EL USUARIO tiene la obligación legal de conservar los XML y PDF por el plazo establecido por la ley (generalmente 5 años para prescripción tributaria).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                6. REGISTRO Y CUENTA DE USUARIO
                            </h2>
                            <p>
                                Para utilizar LA PLATAFORMA, EL USUARIO debe crear una cuenta proporcionando información
                                precisa, completa y actualizada. EL USUARIO es responsable de:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Mantener la confidencialidad de su contraseña y credenciales de acceso.</li>
                                <li>Todas las actividades que ocurran bajo su cuenta.</li>
                                <li>Notificar inmediatamente a LA PLATAFORMA sobre cualquier uso no autorizado de su cuenta.</li>
                                <li>Actualizar su información de contacto, RUC y credenciales del PAC cuando sea necesario.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                7. DISPONIBILIDAD DEL SERVICIO (SLA)
                            </h2>
                            <p>
                                LA PLATAFORMA se esforzará por mantener una disponibilidad del <strong>99.5%</strong>.
                                Sin embargo, el servicio puede verse interrumpido por:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Mantenimiento programado (notificado con al menos 24 horas de anticipación).</li>
                                <li>Fallas en los servicios web de la DGI o del PAC.</li>
                                <li>Problemas de infraestructura de terceros (proveedores de hosting, servicios en la nube).</li>
                                <li>Causas de fuerza mayor (desastres naturales, cortes de energía, conflictos, pandemias).</li>
                            </ul>
                            <p className="mt-2 font-semibold">
                                En ningún caso LA PLATAFORMA será responsable por lucro cesante, pérdida de oportunidades
                                de negocio o multas impuestas por la DGI derivadas de la indisponibilidad temporal del
                                servicio ajena a nuestra negligencia directa.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                8. PROTECCIÓN DE DATOS Y CONFIDENCIALIDAD (LEY 81 DE 2019)
                            </h2>
                            <p>
                                En cumplimiento con la <strong>Ley 81 de 2019 sobre Protección de Datos Personales</strong> en Panamá:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>LA PLATAFORMA tratará los datos del USUARIO y de sus clientes finales <strong>únicamente para los fines de facturación y cumplimiento fiscal</strong>.</li>
                                <li>Se implementan medidas de seguridad técnicas y organizativas (encriptación, control de acceso, auditorías) para proteger la información.</li>
                                <li>EL USUARIO mantiene la titularidad de su base de datos de clientes y puede solicitar exportación o eliminación según lo permita la ley.</li>
                                <li>LA PLATAFORMA podrá compartir la data fiscal estrictamente con el PAC y la DGI según mandato legal.</li>
                                <li>No se compartirá información con terceros sin consentimiento expreso, excepto cuando sea requerido por ley.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                9. PROPIEDAD INTELECTUAL
                            </h2>
                            <p>
                                El software, código fuente, diseño, algoritmos, marcas y contenido de LA PLATAFORMA son
                                propiedad exclusiva de <strong>UbicSystem</strong>. La suscripción otorga a EL USUARIO
                                una licencia de uso <strong>limitada, no exclusiva, intransferible y revocable</strong>.
                            </p>
                            <p className="mt-2">
                                EL USUARIO no podrá:
                            </p>
                            <ul className="list-disc pl-6 space-y-1 mt-1">
                                <li>Copiar, modificar o crear obras derivadas del software.</li>
                                <li>Realizar ingeniería inversa o intentar extraer el código fuente.</li>
                                <li>Sublicenciar, vender o distribuir el servicio a terceros.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                10. PAGOS, SUSCRIPCIÓN Y FOLIOS
                            </h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Planes:</strong> El servicio se presta bajo modalidad de suscripción mensual o anual según el plan elegido.</li>
                                <li><strong>Consumo de Folios:</strong> Cada documento firmado y enviado al PAC (autorizado o rechazado) consume folios del plan contratado. Los folios adicionales se cobrarán según tarifa vigente.</li>
                                <li><strong>Suspensión por Falta de Pago:</strong> La falta de pago resultará en la suspensión inmediata del acceso a LA PLATAFORMA, impidiendo la emisión de nuevas facturas. La data histórica se conservará por 30 días, tras lo cual podrá ser eliminada.</li>
                                <li><strong>Reembolsos:</strong> No se realizan reembolsos por folios consumidos o suscripciones parcialmente utilizadas, excepto por causas imputables a LA PLATAFORMA.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                11. USO ACEPTABLE Y PROHIBICIONES
                            </h2>
                            <p>
                                EL USUARIO se compromete a utilizar LA PLATAFORMA únicamente para fines legales.
                                Está estrictamente prohibido:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Utilizar el servicio para actividades fraudulentas, ilegales o de evasión fiscal.</li>
                                <li>Generar facturas falsas o con información deliberadamente incorrecta.</li>
                                <li>Intentar acceder a áreas no autorizadas del sistema o vulnerar las medidas de seguridad.</li>
                                <li>Interferir con el funcionamiento del servicio o realizar ataques de denegación de servicio.</li>
                                <li>Compartir credenciales de acceso con terceros no autorizados.</li>
                                <li>Usar automatización masiva (bots, scripts) sin autorización previa.</li>
                            </ul>
                            <p className="mt-2 font-semibold text-red-600 dark:text-red-400">
                                El incumplimiento de estas normas resultará en la <strong>suspensión inmediata</strong>
                                de la cuenta sin derecho a reembolso.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                12. LIMITACIÓN DE RESPONSABILIDAD
                            </h2>
                            <p>
                                La responsabilidad máxima de LA PLATAFORMA ante cualquier reclamo, demanda o daño
                                relacionado con este servicio, <strong>no excederá en ningún caso el monto pagado
                                por EL USUARIO durante los últimos tres (3) meses de servicio</strong> anteriores al evento.
                            </p>
                            <p className="mt-2">
                                LA PLATAFORMA no será responsable por:
                            </p>
                            <ul className="list-disc pl-6 space-y-1 mt-1">
                                <li>Daños indirectos, incidentales, consecuentes o punitivos.</li>
                                <li>Pérdida de ingresos, ganancias, datos o uso.</li>
                                <li>Multas o sanciones impuestas por la DGI por errores en datos ingresados por EL USUARIO.</li>
                                <li>Fallas en servicios de terceros (PAC, DGI, proveedores de hosting).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                13. GENERACIÓN DEL CAFE Y CÓDIGO QR
                            </h2>
                            <p>
                                LA PLATAFORMA genera automáticamente el <strong>CAFE (Comprobante Auxiliar de Factura Electrónica)</strong>
                                en formato PDF, el cual incluye:
                            </p>
                            <ul className="list-disc pl-6 space-y-1 mt-2">
                                <li>Representación gráfica del documento fiscal.</li>
                                <li>Código QR que dirige a la consulta oficial en la web de la DGI.</li>
                                <li>Datos fiscales completos conforme a la Ficha Técnica oficial.</li>
                            </ul>
                            <p className="mt-2">
                                El CAFE generado cumple con todos los requisitos del Decreto Ejecutivo 25 de 2022.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                14. MODIFICACIONES A LOS TÉRMINOS
                            </h2>
                            <p>
                                LA PLATAFORMA se reserva el derecho de modificar estos términos en cualquier momento.
                                Las modificaciones entrarán en vigor <strong>7 días después de su publicación</strong>
                                en el sitio web y notificación por correo electrónico.
                            </p>
                            <p className="mt-2">
                                El uso continuado del servicio después de las modificaciones constituye aceptación de los nuevos términos.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                15. TERMINACIÓN DEL SERVICIO
                            </h2>
                            <p>
                                EL USUARIO puede cancelar su suscripción en cualquier momento desde su panel de control.
                                LA PLATAFORMA puede suspender o terminar el servicio si:
                            </p>
                            <ul className="list-disc pl-6 space-y-1 mt-2">
                                <li>EL USUARIO incumple estos Términos y Condiciones.</li>
                                <li>Existe falta de pago por más de 15 días.</li>
                                <li>Se detecta actividad fraudulenta o ilegal.</li>
                                <li>Por orden judicial o administrativa.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                16. LEGISLACIÓN APLICABLE Y JURISDICCIÓN
                            </h2>
                            <p>
                                Este acuerdo se rige por las <strong>leyes de la República de Panamá</strong>.
                                Cualquier disputa será resuelta en los <strong>tribunales competentes de la Ciudad de Panamá</strong>,
                                Distrito de Panamá, República de Panamá.
                            </p>
                            <p className="mt-2">
                                Las partes renuncian expresamente a cualquier otro fuero que pudiera corresponderles.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                                17. CONTACTO Y SOPORTE
                            </h2>
                            <p>
                                Si tiene preguntas sobre estos términos o necesita soporte técnico, puede contactarnos:
                            </p>
                            <ul className="list-none space-y-1 mt-2">
                                <li><strong>Email:</strong> soporte@plentypay.com</li>
                                <li><strong>Horario de atención:</strong> Lunes a Viernes, 8:00 AM - 6:00 PM (Hora de Panamá)</li>
                            </ul>
                        </section>

                        <div className="mt-8 pt-6 border-t border-border">
                            <p className="text-sm text-muted-foreground">
                                <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-PA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className="text-xs text-muted-foreground/80 mt-2">
                                Documento válido para operaciones en la República de Panamá.
                                Cumple con el Decreto Ejecutivo 25 de 2022 y la Ley 81 de 2019.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <LandingFooter />
        </div>
    )
}
