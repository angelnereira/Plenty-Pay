import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@core/database"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { checkRateLimit, rateLimiters } from "@core/middleware/rate-limit"
import { sendEmail, EMAIL_SENDERS } from "@/lib/mail"
import { createSecurityToken } from "@/lib/services/security-token.service"
import { generateQRDataURI } from "@/lib/services/qr-code.service"
import { accountSetupTemplate } from "@/lib/email-templates/account-setup"
import { adminNewRegistrationEmail } from "@/lib/email-templates/transactional"
import { encrypt } from "@/lib/utils/encryption"

// Plan types — v2 (START/BUSINESS/ENTERPRISE). Se aceptan los nombres viejos
// como alias para no romper formularios cacheados; se mapean al nuevo plan.
const PLAN_TYPES_V2 = ["START", "BUSINESS", "ENTERPRISE"] as const
const PLAN_TYPES_LEGACY = ["CRECIMIENTO", "PROFESIONAL", "EMPRESARIAL"] as const
const PLAN_TYPES_ALL = [...PLAN_TYPES_V2, ...PLAN_TYPES_LEGACY] as const
const PLAN_LEGACY_MAP: Record<string, "START" | "BUSINESS" | "ENTERPRISE"> = {
    CRECIMIENTO: "START",
    PROFESIONAL: "BUSINESS",
    EMPRESARIAL: "BUSINESS",
}
const MODULE_IDS = ["billing", "inventory", "pos", "logistics", "people", "bi", "creditos"] as const

// Regex para contraseña (min 8, 1 letra, 1 número, 1 símbolo - cualquier carácter no alfanumérico)
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;

// Schema de validación
const registerSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().regex(PASSWORD_REGEX, "La contraseña debe tener al menos 8 caracteres, una letra, un número y un símbolo"),
    companyName: z.string().min(2, "El nombre de empresa debe tener al menos 2 caracteres"),
    ruc: z.string().min(4, "El RUC es requerido"),
    modules: z.array(z.enum(MODULE_IDS)).min(1, "Debes seleccionar al menos un módulo").optional(),
    billingCycle: z.enum(["monthly", "yearly"]).optional().default("monthly"),
    planType: z.enum(PLAN_TYPES_ALL).optional().default("START"),
    inventoryEnabled: z.boolean().optional().default(false),
    posEnabled: z.boolean().optional().default(false),
    paydayEnabled: z.boolean().optional().default(false),
    hkaTokenUser: z.string().optional(),
    hkaTokenPassword: z.string().optional(),
    lastInvoiceNumber: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(1).optional()
    ),
})

// Generar slug único para la organización
function generateSlug(companyName: string): string {
    const baseSlug = companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
        .replace(/[^a-z0-9]+/g, "-") // Reemplazar caracteres especiales con guiones
        .replace(/^-+|-+$/g, "") // Eliminar guiones al inicio y final

    // Agregar sufijo único
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
    return `${baseSlug}-${uniqueSuffix}`
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting para prevenir abuso de registro
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        await checkRateLimit(rateLimiters.signup, ip)

        const body = await request.json()

        // Validar campos
        const validation = registerSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const {
            name,
            email,
            password,
            companyName,
            ruc,
            modules,
            planType,
            inventoryEnabled,
            posEnabled,
            paydayEnabled,
            hkaTokenUser,
            hkaTokenPassword,
            lastInvoiceNumber,
        } = validation.data

        // Recopilar módulos solicitados. Preferimos el arreglo `modules` del checkout
        // modular; si no viene (compatibilidad con flujos antiguos), derivamos de los
        // flags booleanos.
        let requestedModules: string[]
        if (modules && modules.length > 0) {
            requestedModules = modules
        } else {
            requestedModules = []
            if (inventoryEnabled) requestedModules.push("inventory")
            if (posEnabled) requestedModules.push("pos")
            if (paydayEnabled) requestedModules.push("payday")
        }

        // Calcular período demo de 14 días
        const demoStartDate = new Date()
        const demoEndDate = new Date()
        demoEndDate.setDate(demoEndDate.getDate() + 14)

        // Verificar que el email no esté en uso
        // User enumeration prevention: return generic success for existing emails
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            // Return success to prevent user enumeration
            return NextResponse.json({
                success: true,
                message: "Si el correo no estaba registrado, hemos creado tu solicitud. Revisa tu bandeja de entrada.",
            })
        }

        // Verificar que el RUC no esté en uso
        const existingRuc = await prisma.client.findUnique({
            where: { ruc }
        })

        if (existingRuc) {
            return NextResponse.json(
                { error: "Este RUC ya está registrado" },
                { status: 400 }
            )
        }


        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10)

        // Generar slug único para la organización
        const slug = generateSlug(companyName)

        // Crear organización y usuario en una transacción
        const result = await prisma.$transaction(async (tx) => {
            // Mapear planType legacy → v2 (CRECIMIENTO→START, etc).
            const planTypeV2 = PLAN_LEGACY_MAP[planType] ?? planType

            // Crear la organización (Client) en modo PENDING. Todos los flags
            // de módulos deshabilitados — el SUPER_ADMIN los enciende al aprobar.
            const client = await tx.client.create({
                data: {
                    name: companyName,
                    ruc,
                    slug,
                    isActive: false, // Inactivo hasta aprobación
                    planType: planTypeV2,
                    facturacionEnabled: false,
                    inventoryEnabled: false,
                    posEnabled: false,
                    paydayEnabled: false,
                    logisticsEnabled: false,
                    creditosEnabled: false,
                    motorCreditTier: null,
                    apiAccessEnabled: false,
                    extraBranches: 0,
                    // Estado de aprobación y período demo
                    approvalStatus: "PENDING",
                    demoStartDate,
                    demoEndDate,
                    pendingModules: requestedModules,
                    ...(lastInvoiceNumber !== undefined && { lastInvoiceNumber }),
                },
            })

            // Crear el usuario con UNVERIFIED status
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: "CLIENT",
                    clientId: client.id,
                    isActive: true,
                    status: "UNVERIFIED",
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            })

            // Si el módulo de facturación fue solicitado y se proporcionaron
            // credenciales HKA, las guardamos encriptadas dentro de la misma transacción
            if (
                requestedModules.includes("billing") &&
                hkaTokenUser?.trim() &&
                hkaTokenPassword?.trim()
            ) {
                const encryptedPassword = encrypt(hkaTokenPassword.trim())
                await tx.hKACredential.create({
                    data: {
                        userId: user.id,
                        tokenUser: hkaTokenUser.trim(),
                        tokenPassword: encryptedPassword,
                        environment: "PROD",
                        isActive: true,
                    },
                })
            }

            return { user, client }
        })

        // 3. Generar token de configuración de cuenta (ACCOUNT_SETUP)
        // El enlace verifica el correo y permite al usuario activar su cuenta
        const { rawToken, expiresAt } = await createSecurityToken({
            type: 'ACCOUNT_SETUP',
            email,
            userId: result.user.id,
        })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
        const setupUrl = `${baseUrl}/auth/setup-password?token=${rawToken}&type=setup`
        const qrCodeDataUri = await generateQRDataURI(setupUrl)
        const expiresInHours = Math.round((expiresAt.getTime() - Date.now()) / 3600000)

        // 4. Enviar correo de configuración con QR al usuario
        const html = accountSetupTemplate({
            userName: name,
            companyName,
            setupUrl,
            qrCodeDataUri,
            expiresInHours,
        })

        await sendEmail({
            to: email,
            from: EMAIL_SENDERS.notifications,
            subject: "Configura tu Cuenta - PlentyPay",
            html,
        })

        // 5. Notificar al administrador de la nueva solicitud
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM
        if (adminEmail) {
            await sendEmail({
                to: adminEmail,
                from: EMAIL_SENDERS.notifications,
                subject: `[PlentyPay] Nueva Solicitud de Registro: ${companyName}`,
                html: adminNewRegistrationEmail({
                    companyName,
                    name,
                    email,
                }),
            })
        }

        return NextResponse.json({
            success: true,
            message: "Si el correo no estaba registrado, hemos creado tu solicitud. Revisa tu bandeja de entrada.",
        })
    } catch (error) {
        console.error("Error en registro:", error)
        return NextResponse.json(
            { error: "Error interno del servidor. Por favor intenta nuevamente." },
            { status: 500 }
        )
    }
}
