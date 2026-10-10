"use server"

import { auth } from "@core/auth"
import { prisma } from "@core/database"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const createUserSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    organizationName: z.string().min(2, "Organization name is required"),
    organizationRuc: z.string().optional(),
    planType: z.enum(["CRECIMIENTO", "PROFESIONAL", "EMPRESARIAL", "ENTERPRISE"]).default("CRECIMIENTO"),
    inventoryEnabled: z.boolean().default(false),
    posEnabled: z.boolean().default(false),
    maxUsers: z.number().int().min(1),
    maxPosStations: z.number().int().min(1),
})

export async function createUserAction(data: z.infer<typeof createUserSchema>) {
    try {
        const session = await auth()

        // Authorization check
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return { success: false, error: "Unauthorized" }
        }

        const validatedFields = createUserSchema.safeParse(data)
        if (!validatedFields.success) {
            return {
                success: false,
                error: "Invalid fields",
                details: validatedFields.error.flatten()
            }
        }

        const {
            name,
            email,
            password,
            organizationName,
            organizationRuc,
            planType,
            inventoryEnabled,
            posEnabled,
            maxUsers,
            maxPosStations,
        } = validatedFields.data

        // Check existing email
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return { success: false, error: "Email already in use" }
        }

        // Check existing RUC if provided
        if (organizationRuc) {
            const existingClient = await prisma.client.findUnique({
                where: { ruc: organizationRuc },
            })
            if (existingClient) {
                return { success: false, error: "Organization RUC already in use" }
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        // Create slug from organization name
        const slug = organizationName
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '') + '-' + Math.floor(Math.random() * 10000).toString()

        // Transaction to create Client and User
        // Note: Schema uses 'Client' model, mapped to 'clients' table
        // User maps to 'users' table and has clientId

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Organization (Client)
            const client = await tx.client.create({
                data: {
                    name: organizationName,
                    slug,
                    ruc: organizationRuc || null,
                    planType,
                    inventoryEnabled,
                    posEnabled,
                    maxUsers,
                    maxPosStations,
                    // Defaults
                    address: "",
                    phone: "",
                    email: email, // Use user email as contact initial
                },
            })

            // 2. Create User linked to Client
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: "CLIENT", // Enforced
                    clientId: client.id,
                    isActive: true,
                },
            })

            return { user, client }
        })

        revalidatePath("/dashboard/admin/users")
        return { success: true, user: result.user }

    } catch (error: any) {
        console.error("Error creating user/organization:", error)
        return { success: false, error: error.message || "Internal Server Error" }
    }
}
