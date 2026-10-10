'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Workflow, FileText, Package, Store, Truck,
  Clock, Zap, Shield, Save, Info,
  ToggleLeft, ToggleRight, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateClientWorkflowConfig, updateWorkflowSetting } from '@/app/actions/config/workflow-config.action'
import { toast } from 'sonner'

interface ClientConfig {
  id: string
  autoSendToHKA: boolean
  requireApproval: boolean
  emailOnCertification: boolean
  emailOnError: boolean
  lowFoliosThreshold: number
  inventoryValuationMethod: string
  defaultLeadTimeDays: number
  lowStockAlertEnabled: boolean
  autoReorderEnabled: boolean
  inventoryEnabled: boolean
  posEnabled: boolean
  paydayEnabled: boolean
  logisticsEnabled: boolean
}

interface Props {
  clientConfig: ClientConfig
  workflowSettings: Record<string, string>
}

export function WorkflowConfigClient({ clientConfig, workflowSettings }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(clientConfig)

  // Workflow-specific settings
  const getWorkflowSetting = (key: string, defaultValue: string) => {
    return workflowSettings[key] || defaultValue
  }

  const [invoiceApprovalFlow, setInvoiceApprovalFlow] = useState(
    getWorkflowSetting('workflow.invoice_approval', 'none')
  )
  const [poApprovalFlow, setPOApprovalFlow] = useState(
    getWorkflowSetting('workflow.po_approval', 'none')
  )
  const [defaultTaxRate, setDefaultTaxRate] = useState(
    getWorkflowSetting('workflow.default_tax_rate', '7')
  )
  const [defaultWarehouse, setDefaultWarehouse] = useState(
    getWorkflowSetting('workflow.default_warehouse', 'principal')
  )
  const [autoDeductStock, setAutoDeductStock] = useState(
    getWorkflowSetting('workflow.auto_deduct_stock', 'true') === 'true'
  )
  const [deliveryAutoStatus, setDeliveryAutoStatus] = useState(
    getWorkflowSetting('workflow.delivery_auto_status', 'true') === 'true'
  )

  const handleSaveAll = async () => {
    setSaving(true)

    // Save client-level config
    const clientResult = await updateClientWorkflowConfig({
      autoSendToHKA: config.autoSendToHKA,
      requireApproval: config.requireApproval,
      emailOnCertification: config.emailOnCertification,
      emailOnError: config.emailOnError,
      lowFoliosThreshold: config.lowFoliosThreshold,
      inventoryValuationMethod: config.inventoryValuationMethod,
      defaultLeadTimeDays: config.defaultLeadTimeDays,
      lowStockAlertEnabled: config.lowStockAlertEnabled,
      autoReorderEnabled: config.autoReorderEnabled,
    })

    // Save workflow settings
    const settingsToSave = [
      { key: 'workflow.invoice_approval', value: invoiceApprovalFlow },
      { key: 'workflow.po_approval', value: poApprovalFlow },
      { key: 'workflow.default_tax_rate', value: defaultTaxRate },
      { key: 'workflow.default_warehouse', value: defaultWarehouse },
      { key: 'workflow.auto_deduct_stock', value: String(autoDeductStock) },
      { key: 'workflow.delivery_auto_status', value: String(deliveryAutoStatus) },
    ]

    for (const setting of settingsToSave) {
      await updateWorkflowSetting(setting.key, setting.value)
    }

    setSaving(false)

    if (clientResult.success) {
      toast.success('Configuración de flujos guardada')
      router.refresh()
    } else {
      toast.error(clientResult.error || 'Error al guardar')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
            <Workflow className="h-8 w-8 text-cyan-500" />
            Flujos y Automatización
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Personaliza flujos de trabajo, automatizaciones y valores predeterminados para reducir tareas repetitivas.
          </p>
        </div>

        {/* Invoicing Workflows */}
        <ConfigSection icon={FileText} title="Facturación" color="blue">
          <div className="space-y-4">
            <ToggleOption
              label="Envío automático a HKA/DGI"
              description="Al crear una factura, se envía automáticamente para certificación fiscal."
              checked={config.autoSendToHKA}
              onChange={v => setConfig(prev => ({ ...prev, autoSendToHKA: v }))}
            />
            <ToggleOption
              label="Requerir aprobación antes de emitir"
              description="Las facturas deben ser aprobadas por un usuario autorizado antes de enviarse a la DGI."
              checked={config.requireApproval}
              onChange={v => setConfig(prev => ({ ...prev, requireApproval: v }))}
            />
            <ToggleOption
              label="Email al certificar factura"
              description="Enviar un correo electrónico al cliente cuando la factura es certificada exitosamente."
              checked={config.emailOnCertification}
              onChange={v => setConfig(prev => ({ ...prev, emailOnCertification: v }))}
            />
            <ToggleOption
              label="Email al ocurrir error"
              description="Notificar al administrador cuando una factura tiene un error de procesamiento."
              checked={config.emailOnError}
              onChange={v => setConfig(prev => ({ ...prev, emailOnError: v }))}
            />

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Flujo de aprobación de facturas
              </label>
              <select
                value={invoiceApprovalFlow}
                onChange={e => setInvoiceApprovalFlow(e.target.value)}
                className="w-full max-w-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                <option value="none">Sin aprobación (directo)</option>
                <option value="single">Aprobación simple (1 aprobador)</option>
                <option value="sequential">Aprobación secuencial (múltiples niveles)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Tasa de impuesto predeterminada (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={defaultTaxRate}
                  onChange={e => setDefaultTaxRate(e.target.value)}
                  className="w-full max-w-[150px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">ITBMS en Panamá: 7%</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Alerta de folios bajos
                </label>
                <input
                  type="number"
                  value={config.lowFoliosThreshold}
                  onChange={e => setConfig(prev => ({ ...prev, lowFoliosThreshold: parseInt(e.target.value) || 10 }))}
                  className="w-full max-w-[150px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Notificar cuando queden menos de X folios</p>
              </div>
            </div>
          </div>
        </ConfigSection>

        {/* Inventory Workflows */}
        {config.inventoryEnabled && (
          <ConfigSection icon={Package} title="Inventario" color="emerald">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Método de valuación
                  </label>
                  <select
                    value={config.inventoryValuationMethod}
                    onChange={e => setConfig(prev => ({ ...prev, inventoryValuationMethod: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="WEIGHTED_AVG">Promedio Ponderado</option>
                    <option value="FIFO">FIFO (Primero en entrar, primero en salir)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Tiempo de entrega por defecto (días)
                  </label>
                  <input
                    type="number"
                    value={config.defaultLeadTimeDays}
                    onChange={e => setConfig(prev => ({ ...prev, defaultLeadTimeDays: parseInt(e.target.value) || 7 }))}
                    className="w-full max-w-[150px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              <ToggleOption
                label="Alertas de stock bajo"
                description="Notificar cuando un producto alcance su punto de reorden."
                checked={config.lowStockAlertEnabled}
                onChange={v => setConfig(prev => ({ ...prev, lowStockAlertEnabled: v }))}
              />
              <ToggleOption
                label="Reorden automático"
                description="Generar requisiciones de compra automáticamente al llegar al punto de reorden."
                checked={config.autoReorderEnabled}
                onChange={v => setConfig(prev => ({ ...prev, autoReorderEnabled: v }))}
              />
              <ToggleOption
                label="Descontar stock al facturar"
                description="Al emitir una factura con productos, descontar automáticamente del inventario."
                checked={autoDeductStock}
                onChange={setAutoDeductStock}
              />

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Almacén predeterminado
                </label>
                <input
                  type="text"
                  value={defaultWarehouse}
                  onChange={e => setDefaultWarehouse(e.target.value)}
                  className="w-full max-w-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="principal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Flujo de aprobación de órdenes de compra
                </label>
                <select
                  value={poApprovalFlow}
                  onChange={e => setPOApprovalFlow(e.target.value)}
                  className="w-full max-w-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="none">Sin aprobación</option>
                  <option value="single">Aprobación simple</option>
                  <option value="threshold">Por monto (requiere aprobación sobre umbral)</option>
                </select>
              </div>
            </div>
          </ConfigSection>
        )}

        {/* Logistics Workflows */}
        {config.logisticsEnabled && (
          <ConfigSection icon={Truck} title="Logística" color="rose">
            <div className="space-y-4">
              <ToggleOption
                label="Transición automática de estados"
                description="Actualizar automáticamente el estado del envío basado en eventos (escaneo QR, GPS, etc.)."
                checked={deliveryAutoStatus}
                onChange={setDeliveryAutoStatus}
              />
            </div>
          </ConfigSection>
        )}

        {/* Save All */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando todo...' : 'Guardar Toda la Configuración'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfigSection({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  color: string
  children: React.ReactNode
}) {
  const colorMap: Record<string, { iconBg: string; iconColor: string }> = {
    blue: { iconBg: 'bg-blue-100 dark:bg-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    emerald: { iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    rose: { iconBg: 'bg-rose-100 dark:bg-rose-500/20', iconColor: 'text-rose-600 dark:text-rose-400' },
    amber: { iconBg: 'bg-amber-100 dark:bg-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400' },
    cyan: { iconBg: 'bg-cyan-100 dark:bg-cyan-500/20', iconColor: 'text-cyan-600 dark:text-cyan-400' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl', c.iconBg)}>
          <Icon className={cn('h-5 w-5', c.iconColor)} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
      <div>
        <span className="text-sm font-bold text-gray-800 dark:text-white block">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="shrink-0 mt-0.5"
      >
        {checked ? (
          <ToggleRight className="h-7 w-7 text-cyan-600" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-gray-400" />
        )}
      </button>
    </div>
  )
}
