import { NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { auth } from '@core/auth';
import { z } from 'zod';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HKA-Credentials-API');

const credentialsSchema = z.object({
  tokenUser: z.string().min(1, 'Token de usuario es requerido'),
  tokenPassword: z.string().min(1, 'Token password es requerido'),
  environment: z.enum(['demo', 'prod']),
  // Datos del contribuyente
  ruc: z.string().optional(),
  dv: z.string().optional(),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { client: true }
    });

    if (!user || !user.client) {
      return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 });
    }

    const body = await request.json();
    const data = credentialsSchema.parse(body);

    logger.debug({ environment: data.environment }, 'Processing HKA credentials update');

    const environmentEnum = data.environment === 'prod' ? 'PROD' : 'DEMO';

    await prisma.$transaction(async (tx) => {
      // Marcar otras credenciales como inactivas
      await tx.hKACredential.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });

      await tx.hKACredential.upsert({
        where: {
          userId_environment: {
            userId: user.id,
            environment: environmentEnum,
          },
        },
        update: {
          tokenUser: data.tokenUser,
          tokenPassword: data.tokenPassword,
          isActive: true,
        },
        create: {
          userId: user.id,
          environment: environmentEnum,
          tokenUser: data.tokenUser,
          tokenPassword: data.tokenPassword,
          isActive: true,
        },
      });

      // Mantener datos del contribuyente actualizados a nivel de organización
      await tx.client.update({
        where: { id: user.clientId },
        data: {
          hkaEnvironment: data.environment,
          ...(data.ruc && { ruc: data.ruc }),
          ...(data.dv && { dv: data.dv }),
          ...(data.razonSocial && { name: data.razonSocial }),
          ...(data.nombreComercial && { tradeName: data.nombreComercial }),
          ...(data.email && { email: data.email }),
          ...(data.telefono && { phone: data.telefono }),
          ...(data.direccion && { address: data.direccion }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciales HKA guardadas correctamente',
      environment: data.environment,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to save HKA credentials');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { client: true }
    });

    if (!user || !user.client) {
      return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 });
    }

    const [org, userCredentials] = await Promise.all([
      prisma.client.findUnique({
        where: { id: user.clientId },
        select: {
          hkaTokenUser: true,
          hkaEnvironment: true,
          ruc: true,
          dv: true,
          name: true,
          tradeName: true,
          email: true,
          phone: true,
          address: true,
        },
      }),
      prisma.hKACredential.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    logger.debug({ hasOrg: !!org, hasCredentials: userCredentials.length > 0 }, 'Retrieved org data');

    const environmentMap: Record<'demo' | 'prod', { tokenUser: string | null; isActive: boolean; lastUpdated: string | null }> = {
      demo: { tokenUser: null, isActive: false, lastUpdated: null },
      prod: { tokenUser: null, isActive: false, lastUpdated: null },
    };

    let activeEnvironment: 'demo' | 'prod' | null = null;

    userCredentials.forEach((credential) => {
      const envKey = credential.environment === 'PROD' ? 'prod' : 'demo';
      environmentMap[envKey] = {
        tokenUser: credential.tokenUser,
        isActive: credential.isActive,
        lastUpdated: credential.updatedAt.toISOString(),
      };

      if (credential.isActive && !activeEnvironment) {
        activeEnvironment = envKey;
      }
    });

    if (!activeEnvironment) {
      activeEnvironment = (org?.hkaEnvironment || 'demo').toLowerCase() === 'prod' ? 'prod' : 'demo';
    }

    const fallback = org?.hkaTokenUser
      ? {
        tokenUser: org.hkaTokenUser,
        environment: (org.hkaEnvironment || 'demo').toLowerCase() === 'prod' ? 'prod' : 'demo',
      }
      : null;

    const activeTokenUser =
      environmentMap[activeEnvironment].tokenUser ??
      fallback?.tokenUser ??
      null;

    const configured =
      Object.values(environmentMap).some((env) => env.tokenUser) ||
      !!fallback;

    return NextResponse.json({
      configured,
      tokenUser: activeTokenUser,
      environment: activeEnvironment,
      environments: environmentMap,
      fallback,
      ruc: org?.ruc || null,
      dv: org?.dv || null,
      razonSocial: org?.name || null,
      nombreComercial: org?.tradeName || null,
      email: org?.email || null,
      telefono: org?.phone || null,
      direccion: org?.address || null,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get HKA credentials');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

