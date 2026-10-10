import { NextRequest, NextResponse } from 'next/server'
import { prismaServer as prisma } from '@core/database'
import { rateLimiters, checkRateLimit } from '@core/middleware/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  try {
    const { qrToken } = await params
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'

    // 1. Rate Limiting (Rule 5)
    await checkRateLimit(rateLimiters.logisticsTrack, ip)

    // 2. Find Order (Rule 8)
    const order = await prisma.deliveryOrder.findUnique({
      where: { qrToken },
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        carrier: { select: { name: true } },
        driver: { select: { firstName: true, lastName: true, phone: true } },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Orden no encontrada', code: 'LOGISTICS_004' },
        { status: 404 }
      )
    }

    // 3. Log Scan (Rule 8)
    await prisma.qRScanLog.create({
      data: {
        deliveryOrderId: order.id,
        qrToken,
        ip: ip,
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    // 4. Log Event (Rule 10)
    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: order.id,
        eventType: 'QR_SCANNED',
        actorType: 'PUBLIC',
        actorName: 'Anónimo (QR)',
        metadata: { ip, userAgent: request.headers.get('user-agent') },
      },
    })

    // 5. Response (Desensitized for public view)
    return NextResponse.json({
      code: order.code,
      status: order.status,
      customerName: order.customerName,
      scheduledDate: order.scheduledDate,
      estimatedDate: order.estimatedDate,
      deliveredAt: order.deliveredAt,
      carrier: order.carrier?.name,
      driver: order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : null,
      items: order.items.map(i => ({
        description: i.description,
        quantity: i.quantity.toString(),
      })),
      statusHistory: order.statusHistory.map(h => ({
        status: h.toStatus,
        date: h.createdAt,
        notes: h.notes
      }))
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'RateLimitError') {
      const rateLimitError = error as Error & { toHeaders?: () => HeadersInit }
      return NextResponse.json(
        { error: 'Demasiadas consultas. Intente más tarde.', code: 'RATE_LIMIT' },
        { status: 429, headers: rateLimitError.toHeaders?.() }
      )
    }
    console.error('[PublicTrack] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'LOGISTICS_500' },
      { status: 500 }
    )
  }
}
