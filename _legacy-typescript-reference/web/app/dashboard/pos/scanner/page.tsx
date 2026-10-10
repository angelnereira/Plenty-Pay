import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@core/auth';
import { prisma } from '@/lib/db';
import { ScannerResolver } from './_components/ScannerResolver';
import type { PosProduct } from '@/features/pos/stores/pos.store';

export const metadata = { title: 'POS Scanner — PlentyPay' };

async function ScannerContent({ userId, userRole }: { userId: string; userRole?: string | null }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { client: true },
  });

  if (!user?.clientId) redirect('/');
  if (!user.client?.posEnabled && userRole !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const productsRaw = await prisma.product.findMany({
    where: {
      clientId: user.clientId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      salePrice: true,
      barcode: true,
      sku: true,
      taxRate: true,
      image: true,
      currentStock: true,
    },
  });

  const products: PosProduct[] = productsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.salePrice),
    taxRate: Number(p.taxRate),
    barcode: p.barcode ?? undefined,
    image: p.image ?? undefined,
    sku: p.sku ?? undefined,
    stock: Number(p.currentStock),
  }));

  const businessName = user.client?.name ?? 'PlentyPay';

  return <ScannerResolver products={products} businessName={businessName} />;
}

function ScannerSkeleton() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-white/60 text-sm font-medium">Cargando POS...</p>
    </div>
  );
}

export default async function ScannerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  return (
    <Suspense fallback={<ScannerSkeleton />}>
      <ScannerContent userId={session.user.id} userRole={session.user.role} />
    </Suspense>
  );
}
