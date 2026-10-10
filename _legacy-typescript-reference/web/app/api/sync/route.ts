import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/core/auth'
import { prisma } from '@/core/database/prisma'

/**
 * Delta Synchronization API Endpoint
 * 
 * Implements Local-First delta sync strategy:
 * - Client sends ?since={ISO timestamp} of last successful sync
 * - Server returns only records changed after that timestamp
 * - Includes both created/updated records and deleted IDs
 * 
 * Response format:
 * {
 *   syncTimestamp: string, // Server timestamp for next sync
 *   customers: { changed: Customer[], deletedIds: string[] },
 *   invoices: { changed: Invoice[], deletedIds: string[] },
 * }
 */

interface DeltaSyncResponse {
    syncTimestamp: string
    customers: {
        changed: Array<{
            id: string
            ruc: string
            dv: string
            name: string
            email: string | null
            phone: string | null
            address: string
            isActive: boolean
            updatedAt: string
        }>
        deletedIds: string[]
    }
    invoices: {
        changed: Array<{
            id: string
            clientReferenceId: string
            customerId: string | null
            receiverName: string
            documentType: string
            invoiceNumber: string | null
            cufe: string | null
            total: number
            status: string
            issueDate: string
            updatedAt: string
        }>
        deletedIds: string[]
    }
}

export async function GET(request: NextRequest) {
    try {
        // Authenticate user using NextAuth v5 auth()
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Get the 'since' timestamp from query params
        const searchParams = request.nextUrl.searchParams
        const sinceParam = searchParams.get('since')

        // Parse the timestamp or default to epoch (fetch all)
        const since = sinceParam ? new Date(sinceParam) : new Date(0)

        // Validate the date
        if (isNaN(since.getTime())) {
            return NextResponse.json(
                { error: 'Invalid since parameter. Expected ISO 8601 format.' },
                { status: 400 }
            )
        }

        // Get the current server timestamp for the response
        const syncTimestamp = new Date().toISOString()

        // Get user's clientId for multi-tenant filtering
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { clientId: true }
        })

        if (!user?.clientId) {
            return NextResponse.json(
                { error: 'User not associated with a client' },
                { status: 403 }
            )
        }

        // Fetch changed customers (updatedAt > since, not soft-deleted)
        const changedCustomers = await prisma.customer.findMany({
            where: {
                clientId: user.clientId,
                updatedAt: { gt: since },
                deletedAt: null, // Not soft-deleted
            },
            select: {
                id: true,
                ruc: true,
                dv: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                isActive: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: 'asc' },
            take: 500, // Limit to prevent huge responses
        })

        // Fetch soft-deleted customer IDs (for client-side removal)
        const deletedCustomers = await prisma.customer.findMany({
            where: {
                clientId: user.clientId,
                deletedAt: { gt: since },
            },
            select: { id: true },
        })

        // Fetch changed invoices (updatedAt > since, not soft-deleted)
        const changedInvoices = await prisma.invoice.findMany({
            where: {
                clientId: user.clientId,
                updatedAt: { gt: since },
                deletedAt: null,
            },
            select: {
                id: true,
                clientReferenceId: true,
                customerId: true,
                receiverName: true,
                documentType: true,
                invoiceNumber: true,
                cufe: true,
                total: true,
                status: true,
                issueDate: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: 'asc' },
            take: 500,
        })

        // Fetch soft-deleted invoice IDs
        const deletedInvoices = await prisma.invoice.findMany({
            where: {
                clientId: user.clientId,
                deletedAt: { gt: since },
            },
            select: { id: true },
        })

        const response: DeltaSyncResponse = {
            syncTimestamp,
            customers: {
                changed: changedCustomers.map(c => ({
                    ...c,
                    updatedAt: c.updatedAt.toISOString(),
                })),
                deletedIds: deletedCustomers.map(c => c.id),
            },
            invoices: {
                changed: changedInvoices.map(i => ({
                    ...i,
                    total: Number(i.total),
                    issueDate: i.issueDate.toISOString(),
                    updatedAt: i.updatedAt.toISOString(),
                })),
                deletedIds: deletedInvoices.map(i => i.id),
            },
        }

        // Log sync request for monitoring
        console.log(`[Delta Sync] Client ${user.clientId}: ${changedCustomers.length} customers, ${changedInvoices.length} invoices since ${since.toISOString()}`)

        return NextResponse.json(response)
    } catch (error) {
        console.error('[Delta Sync] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
