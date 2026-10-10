// __tests__/facturas-page-client.test.tsx
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock all heavy dependencies so the component renders in isolation
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'test-user', organizationId: 'test-org' } }, status: 'authenticated' }),
}))
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}))
jest.mock('@/lib/offline-db', () => ({
  getPendingInvoices: jest.fn().mockResolvedValue([]),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('next/dynamic', () => (fn: () => Promise<{ default: React.ComponentType }>) => {
  const DynamicComponent = () => null
  DynamicComponent.displayName = 'DynamicComponent'
  return DynamicComponent
})
jest.mock('@/features/invoicing/ui/responsive-invoice-list', () => ({
  ResponsiveInvoiceList: () => null,
}))
jest.mock('@/features/invoicing/ui/invoice-filters', () => ({
  InvoiceFilters: () => null,
}))
jest.mock('@/components/dashboard/action-card', () => ({
  ActionCard: () => null,
}))
jest.mock('@/features/invoicing/ui/contingency-banner', () => ({
  ContingencyBanner: () => null,
}))
jest.mock('@/components/dashboard/mobile-header', () => ({
  MobileHeader: () => null,
}))
jest.mock('@/hooks/useServerActionMutation', () => ({
  useQueryInvalidation: () => ({ invalidateAll: jest.fn() }),
}))
jest.mock('@shared/hooks/use-invoices', () => ({
  useInvoices: (initial: unknown) => ({ data: initial }),
}))
jest.mock('@/components/dashboard/invoice-generator-provider', () => ({
  useInvoiceGenerator: () => ({ openGenerator: jest.fn(), optimisticInvoices: [] }),
}))
jest.mock('@/app/actions/invoice/parse-invoice-file.action', () => ({
  parseInvoiceFile: jest.fn(),
}))

import { FacturasPageClient } from '@/app/dashboard/facturas/facturas-page-client'

const mockInitialData = {
  invoices: [],
  stats: { total: 0, emitted: 0, draft: 0, processing: 0, error: 0, canceled: 0, totalAmount: 0, totalItbms: 0 },
}

describe('FacturasPageClient', () => {
  it('no muestra el botón Herramientas', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    expect(screen.queryByText(/herramientas/i)).not.toBeInTheDocument()
  })

  it('muestra las consultas DGI en el menú "Más acciones"', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    // Las consultas DGI viven en un menú desplegable, no como botones sueltos
    fireEvent.click(screen.getByRole('button', { name: /más acciones/i }))
    expect(screen.getByRole('menuitem', { name: /estado dgi/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /validar ruc/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /consultar folios/i })).toBeInTheDocument()
  })

  it('no muestra botones redundantes de descarga ni anulación en la barra', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    // Estos solo deben aparecer por fila, no como botones globales en la barra
    expect(screen.queryByRole('button', { name: /descargar pdf/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /descargar xml/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar email/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anular factura/i })).not.toBeInTheDocument()
  })
})
