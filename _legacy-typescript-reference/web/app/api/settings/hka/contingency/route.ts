import { NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { z } from 'zod';
import {
  getHKASystemConfig,
  setHKASystemConfig,
} from '@/features/hka/model/repositories/hka-config.repository';

const activateSchema = z.object({
  motivo: z
    .string()
    .min(15, 'El motivo debe tener al menos 15 caracteres')
    .max(250, 'El motivo no puede exceder 250 caracteres'),
  tipo: z.enum(['02', '04']).refine((v) => v === '02' || v === '04', {
    message: "tipo debe ser '02' (internet contribuyente) o '04' (fallas DGI)",
  }),
});

/** GET — retorna el estado actual de contingencia */
export async function GET() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { clientId } = session.user;

  const activa = (await getHKASystemConfig(clientId, 'hka.contingenciaActiva', 'false')) === 'true';
  const inicio = await getHKASystemConfig(clientId, 'hka.contingenciaInicio', '');
  const motivo = await getHKASystemConfig(clientId, 'hka.contingenciaMotivo', '');
  const tipo = await getHKASystemConfig(clientId, 'hka.contingenciaTipo', '');

  return NextResponse.json({ activa, inicio: inicio || null, motivo: motivo || null, tipo: tipo || null });
}

/** POST — activa el modo contingencia */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { clientId } = session.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { motivo, tipo } = parsed.data;
  const inicio = new Date().toISOString();

  await Promise.all([
    setHKASystemConfig(clientId, 'hka.contingenciaActiva', 'true'),
    setHKASystemConfig(clientId, 'hka.contingenciaInicio', inicio),
    setHKASystemConfig(clientId, 'hka.contingenciaMotivo', motivo),
    setHKASystemConfig(clientId, 'hka.contingenciaTipo', tipo),
  ]);

  return NextResponse.json({ success: true, inicio, motivo, tipo });
}

/** DELETE — desactiva el modo contingencia */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { clientId } = session.user;

  await Promise.all([
    setHKASystemConfig(clientId, 'hka.contingenciaActiva', 'false'),
    setHKASystemConfig(clientId, 'hka.contingenciaInicio', ''),
    setHKASystemConfig(clientId, 'hka.contingenciaMotivo', ''),
    setHKASystemConfig(clientId, 'hka.contingenciaTipo', ''),
  ]);

  return NextResponse.json({ success: true });
}
