'use client'

import { Shield, Database, Lock, UserCheck, Clock, Cookie, Bell } from "lucide-react"
import { LandingNavbar, LandingFooter } from "@/components/landing"

export default function PrivacyPage() {
    const lastUpdated = new Date().toLocaleDateString('es-PA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <div className="min-h-screen bg-background text-foreground">
            <LandingNavbar />

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">
                <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 lg:p-10">
                    {/* Title */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                            Política de Privacidad de Datos
                        </h1>
                        <p className="text-muted-foreground">PLENTYPAY</p>
                        <p className="text-sm text-muted-foreground/80 mt-2">Última actualización: {lastUpdated}</p>
                    </div>

                    {/* Sections */}
                    <div className="space-y-8 text-muted-foreground">
                        {/* Section 1 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">1</div>
                                <h2 className="text-xl font-semibold text-foreground">Identidad del Responsable del Tratamiento</h2>
                            </div>
                            <div className="pl-11 space-y-3 text-sm leading-relaxed">
                                <p>
                                    El responsable del tratamiento de los datos personales recolectados a través de la plataforma web
                                    <strong className="text-foreground"> PlentyPay</strong> (en adelante &ldquo;La Plataforma&rdquo;) es <strong className="text-foreground">PlentyPay</strong> (en adelante &ldquo;El Responsable&rdquo;),
                                    con domicilio en Colón, República de Panamá y correo de contacto para asuntos de privacidad:
                                    <a href="mailto:soporte@plentypay.com" className="text-primary hover:underline ml-1">soporte@plentypay.com</a>.
                                </p>
                                <p>
                                    El tratamiento de los datos se rige por la <strong className="text-foreground">Ley 81 de 2019</strong> sobre
                                    Protección de Datos Personales y el <strong className="text-foreground">Decreto Ejecutivo 285 de 2021</strong> de la República de Panamá.
                                </p>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">2</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Datos que Recolectamos
                                </h2>
                            </div>
                            <div className="pl-11 space-y-4 text-sm leading-relaxed">
                                <p>Para la prestación del servicio de Facturación Electrónica, recolectamos las siguientes categorías de datos:</p>

                                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-foreground mb-2">2.1. Datos de Registro (Usuario/Cliente)</h4>
                                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                            <li>Nombre completo o Razón Social</li>
                                            <li>Número de RUC y Dígito Verificador (DV)</li>
                                            <li>Correo electrónico y número de teléfono</li>
                                            <li>Dirección física (Provincia, Distrito, Corregimiento)</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-foreground mb-2">2.2. Datos de Facturación (Clientes de nuestros Clientes)</h4>
                                        <p className="text-muted-foreground">
                                            Al emitir facturas, usted ingresa datos de terceros en nuestra plataforma. PlentyPay actúa como
                                            <strong className="text-foreground"> Encargado del Tratamiento (Custodio)</strong> de estos datos, mientras que usted
                                            mantiene la calidad de <strong className="text-foreground">Responsable</strong> frente a sus clientes finales.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-foreground mb-2">2.3. Credenciales Sensibles (Integración PAC)</h4>
                                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                            <li><strong className="text-foreground">Token y Contraseña de HKA:</strong> Necesarias para la conexión SOAP con el Proveedor Autorizado Calificado (The Factory HKA)</li>
                                            <li><strong className="text-foreground">Tratamiento Especial:</strong> Almacenadas con encriptación robusta (AES-256-CBC) y no visibles en texto plano</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-foreground mb-2">2.4. Datos Técnicos y de Navegación</h4>
                                        <p className="text-muted-foreground">
                                            Direcciones IP, tipo de navegador, sistema operativo y logs de errores para garantizar la seguridad y estabilidad del sistema.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">3</div>
                                <h2 className="text-xl font-semibold text-foreground">Finalidad del Tratamiento</h2>
                            </div>
                            <div className="pl-11 space-y-3 text-sm leading-relaxed">
                                <p>Utilizamos sus datos exclusivamente para:</p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span><strong className="text-foreground">Prestación del Servicio:</strong> Generar, firmar, certificar y enviar sus Facturas Electrónicas ante el PAC y la DGI.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span><strong className="text-foreground">Cumplimiento Legal:</strong> Almacenar los documentos fiscales por el tiempo estipulado por las leyes tributarias de Panamá.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span><strong className="text-foreground">Soporte y Mejora:</strong> Resolver incidencias técnicas y notificar sobre actualizaciones críticas.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span><strong className="text-foreground">Seguridad:</strong> Prevenir fraudes y accesos no autorizados a su cuenta.</span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">4</div>
                                <h2 className="text-xl font-semibold text-foreground">Transferencia de Datos a Terceros</h2>
                            </div>
                            <div className="pl-11 space-y-4 text-sm leading-relaxed">
                                <p><strong className="text-foreground">PlentyPay no vende sus datos.</strong> Sin embargo, para que el sistema funcione, es estrictamente necesario compartir cierta información con:</p>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-foreground font-semibold">Entidad</th>
                                                <th className="px-4 py-3 text-left text-foreground font-semibold">Función</th>
                                                <th className="px-4 py-3 text-left text-foreground font-semibold">Ubicación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            <tr className="bg-muted/50">
                                                <td className="px-4 py-3 text-foreground">The Factory HKA Corp.</td>
                                                <td className="px-4 py-3 text-muted-foreground">Proveedor PAC (Certificación)</td>
                                                <td className="px-4 py-3 text-muted-foreground">Panamá (Regulado por DGI)</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-foreground">Dirección General de Ingresos (DGI)</td>
                                                <td className="px-4 py-3 text-muted-foreground">Autoridad Fiscal</td>
                                                <td className="px-4 py-3 text-muted-foreground">Panamá (Gobierno)</td>
                                            </tr>
                                            <tr className="bg-muted/50">
                                                <td className="px-4 py-3 text-foreground">Vercel Inc.</td>
                                                <td className="px-4 py-3 text-muted-foreground">Hosting y Despliegue</td>
                                                <td className="px-4 py-3 text-muted-foreground">EE.UU. (Proveedor Cloud)</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-foreground">Neon (PostgreSQL)</td>
                                                <td className="px-4 py-3 text-muted-foreground">Base de Datos</td>
                                                <td className="px-4 py-3 text-muted-foreground">EE.UU. (Proveedor Cloud)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-muted-foreground italic">
                                    Al aceptar esta política, usted autoriza expresamente estas transferencias necesarias para la ejecución técnica del servicio.
                                </p>
                            </div>
                        </section>

                        {/* Section 5 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">5</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <Lock className="h-5 w-5" />
                                    Seguridad de los Datos
                                </h2>
                            </div>
                            <div className="pl-11 space-y-3 text-sm leading-relaxed">
                                <p>Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger su información:</p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span><strong className="text-foreground">Cifrado en tránsito:</strong> Todas las comunicaciones usan HTTPS/TLS 1.2+</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span><strong className="text-foreground">Cifrado en reposo:</strong> Contraseñas y tokens sensibles encriptados en la base de datos</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span><strong className="text-foreground">Acceso restringido:</strong> Autenticación robusta (NextAuth) y segregación de datos por cliente (Multi-tenancy)</span>
                                    </li>
                                </ul>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
                                    <p className="text-amber-200 text-sm">
                                        <strong>Nota:</strong> Ningún sistema es 100% infalible. En caso de una brecha de seguridad que comprometa sus datos personales,
                                        notificaremos a los afectados y a la ANTAI conforme lo exige la ley.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 6 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">6</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <UserCheck className="h-5 w-5" />
                                    Derechos ARCO (Sus Derechos)
                                </h2>
                            </div>
                            <div className="pl-11 space-y-4 text-sm leading-relaxed">
                                <p>Como titular de los datos, la <strong className="text-foreground">Ley 81</strong> le otorga los siguientes derechos ARCO:</p>

                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-1">Acceso</h4>
                                        <p className="text-muted-foreground text-sm">Conocer qué datos tenemos sobre usted.</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-1">Rectificación</h4>
                                        <p className="text-muted-foreground text-sm">Corregir datos inexactos o desactualizados.</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-1">Cancelación</h4>
                                        <p className="text-muted-foreground text-sm">Solicitar la eliminación de sus datos cuando ya no sean necesarios.*</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-1">Oposición</h4>
                                        <p className="text-muted-foreground text-sm">Oponerse al tratamiento para fines específicos.</p>
                                    </div>
                                </div>

                                <p className="text-muted-foreground/80 text-xs">*Nota: Ciertos datos fiscales no pueden borrarse inmediatamente por obligación tributaria.</p>

                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                                    <p className="text-primary">
                                        Para ejercer estos derechos, envíe una solicitud a <a href="mailto:soporte@plentypay.com" className="text-primary hover:underline">soporte@plentypay.com</a>.
                                        Responderemos en un plazo máximo de <strong>10 días hábiles</strong>.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 7 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">7</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Conservación de Datos
                                </h2>
                            </div>
                            <div className="pl-11 text-sm leading-relaxed">
                                <p>
                                    Mantendremos sus datos personales y registros de facturación mientras su cuenta esté activa y, posteriormente,
                                    durante el periodo requerido por la legislación fiscal panameña (generalmente <strong className="text-foreground">5 años</strong>)
                                    para atender posibles auditorías de la DGI.
                                </p>
                            </div>
                        </section>

                        {/* Section 8 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">8</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <Cookie className="h-5 w-5" />
                                    Uso de Cookies
                                </h2>
                            </div>
                            <div className="pl-11 text-sm leading-relaxed">
                                <p>
                                    Utilizamos <strong className="text-foreground">cookies esenciales de sesión</strong> (gestionadas por NextAuth) para mantenerle
                                    identificado mientras navega por la plataforma. <strong className="text-foreground">No utilizamos cookies publicitarias ni de rastreo</strong> de terceros para fines de marketing.
                                </p>
                            </div>
                        </section>

                        {/* Section 9 */}
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">9</div>
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <Bell className="h-5 w-5" />
                                    Cambios a esta Política
                                </h2>
                            </div>
                            <div className="pl-11 text-sm leading-relaxed">
                                <p>
                                    Nos reservamos el derecho de modificar esta Política de Privacidad para adaptarla a novedades legislativas
                                    (ej. nuevas resoluciones de la DGI) o mejoras técnicas. Cualquier cambio sustancial será notificado a través
                                    de la plataforma o por correo electrónico.
                                </p>
                            </div>
                        </section>

                        {/* Legal Footer */}
                        <div className="border-t border-border pt-8 mt-8">
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                <p className="text-sm text-muted-foreground mb-2">
                                    Esta política cumple con la <strong className="text-foreground">Ley 81 de 2019</strong> de Protección de Datos Personales
                                    y es revisable por la <strong className="text-foreground">ANTAI</strong> (Autoridad Nacional de Transparencia y Acceso a la Información).
                                </p>
                                <p className="text-sm text-muted-foreground/80">
                                    Contacto: <a href="mailto:soporte@plentypay.com" className="text-primary hover:underline">soporte@plentypay.com</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <LandingFooter />
        </div>
    )
}
