'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock, DollarSign, Shield, Gift,
  Calendar, Building2, Save, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { updatePayrollConfig, updatePayrollSetting } from '@/app/actions/config/payroll-config.action'
import { toast } from 'sonner'

interface PaydayConfig {
  id: string
  payFrequency: string
  commercialZone: string
  operationalHours: { start: string; end: string; days: number[] } | null
}

// Panama legal deduction defaults
const DEFAULT_DEDUCTIONS = {
  css_employee: 9.75, // CSS cuota obrero
  css_employer: 12.25, // CSS cuota patronal
  educational_insurance: 1.25, // Seguro educativo (empleador)
  professional_risk: 1.62, // Riesgo profesional promedio
  isr_enabled: true, // Impuesto sobre la renta
  isr_brackets: [
    { from: 0, to: 11000, rate: 0 },
    { from: 11000, to: 50000, rate: 15 },
    { from: 50000, to: Infinity, rate: 25 },
  ],
}

const DEFAULT_BENEFITS = {
  thirteenth_month: true, // Décimo tercer mes (obligatorio en Panamá)
  thirteenth_month_method: 'accrual', // 'accrual' or 'lump_sum'
  vacation_days_per_year: 30, // 30 días por año (ley panameña)
  vacation_proportional: true,
  seniority_premium: true, // Prima de antigüedad
  seniority_premium_weeks: 1, // Semanas por año
}

interface Props {
  initialConfig: PaydayConfig
  initialSettings: Record<string, string>
}

export function PayrollConfigClient({ initialConfig, initialSettings }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(initialConfig)

  const deductions = initialSettings['payroll.deductions']
    ? JSON.parse(initialSettings['payroll.deductions'])
    : DEFAULT_DEDUCTIONS

  const benefits = initialSettings['payroll.benefits']
    ? JSON.parse(initialSettings['payroll.benefits'])
    : DEFAULT_BENEFITS

  const [dedState, setDedState] = useState(deductions)
  const [benState, setBenState] = useState(benefits)

  const handleSaveGeneral = async () => {
    setSaving(true)
    const result = await updatePayrollConfig({
      payFrequency: config.payFrequency as any,
      commercialZone: config.commercialZone as any,
      operationalHours: config.operationalHours || undefined,
    })
    setSaving(false)
    if (result.success) {
      toast.success('Configuración general guardada')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleSaveDeductions = async () => {
    setSaving(true)
    const result = await updatePayrollSetting({
      key: 'payroll.deductions',
      value: JSON.stringify(dedState),
    })
    setSaving(false)
    if (result.success) toast.success('Deducciones guardadas')
    else toast.error(result.error || 'Error')
  }

  const handleSaveBenefits = async () => {
    setSaving(true)
    const result = await updatePayrollSetting({
      key: 'payroll.benefits',
      value: JSON.stringify(benState),
    })
    setSaving(false)
    if (result.success) toast.success('Beneficios guardados')
    else toast.error(result.error || 'Error')
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            Configuración de Nómina
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Configura la periodicidad de pago, deducciones legales y beneficios.
          </p>
        </div>

        {/* Section 1: General */}
        <ConfigSection
          icon={Calendar}
          title="Periodicidad y Zona Comercial"
          description="Define la frecuencia de pago y el tipo de zona comercial de tu empresa."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Frecuencia de Pago
              </label>
              <div className="space-y-2">
                {[
                  { value: 'WEEKLY', label: 'Semanal', desc: 'Pago cada 7 días' },
                  { value: 'BIWEEKLY', label: 'Quincenal', desc: 'Pago cada 15 días' },
                  { value: 'MONTHLY', label: 'Mensual', desc: 'Pago cada 30 días' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      config.payFrequency === opt.value
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/50'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="payFrequency"
                      value={opt.value}
                      checked={config.payFrequency === opt.value}
                      onChange={() => setConfig(prev => ({ ...prev, payFrequency: opt.value }))}
                      className="sr-only"
                    />
                    <div className={cn(
                      'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                      config.payFrequency === opt.value ? 'border-amber-500' : 'border-gray-300'
                    )}>
                      {config.payFrequency === opt.value && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{opt.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Zona Comercial
              </label>
              <select
                value={config.commercialZone}
                onChange={e => setConfig(prev => ({ ...prev, commercialZone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                <option value="NORMAL">Normal</option>
                <option value="ZONA_FRANCA">Zona Franca</option>
                <option value="CASINO">Casino / Juegos de Azar</option>
                <option value="HOTEL">Hotel / Turismo</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Afecta las tasas de riesgo profesional y reglas de horas extras
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveGeneral}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </ConfigSection>

        {/* Section 2: Legal Deductions */}
        <ConfigSection
          icon={Shield}
          title="Deducciones Legales (Panamá)"
          description="Configura las tasas de CSS, seguro educativo e impuesto sobre la renta aplicables."
        >
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Las tasas predeterminadas corresponden a la legislación vigente en Panamá. Modifica solo si tu empresa tiene condiciones especiales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberField
              label="CSS Cuota Obrero (%)"
              value={dedState.css_employee}
              onChange={v => setDedState((prev: typeof dedState) => ({ ...prev, css_employee: v }))}
            />
            <NumberField
              label="CSS Cuota Patronal (%)"
              value={dedState.css_employer}
              onChange={v => setDedState((prev: typeof dedState) => ({ ...prev, css_employer: v }))}
            />
            <NumberField
              label="Seguro Educativo - Empleador (%)"
              value={dedState.educational_insurance}
              onChange={v => setDedState((prev: typeof dedState) => ({ ...prev, educational_insurance: v }))}
            />
            <NumberField
              label="Riesgo Profesional (%)"
              value={dedState.professional_risk}
              onChange={v => setDedState((prev: typeof dedState) => ({ ...prev, professional_risk: v }))}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3">Impuesto Sobre la Renta (ISR)</h4>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dedState.isr_enabled}
                onChange={e => setDedState((prev: typeof dedState) => ({ ...prev, isr_enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Aplicar retención de ISR</span>
            </label>

            {dedState.isr_enabled && (
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tabla de retención anual</p>
                {dedState.isr_brackets?.map((bracket: { from: number; to: number; rate: number }, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-mono">B/. {bracket.from.toLocaleString()}</span>
                    <span>—</span>
                    <span className="font-mono">{bracket.to === Infinity ? '∞' : `B/. ${bracket.to.toLocaleString()}`}</span>
                    <span className="ml-auto font-bold text-gray-800 dark:text-white">{bracket.rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveDeductions}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Deducciones'}
            </button>
          </div>
        </ConfigSection>

        {/* Section 3: Benefits */}
        <ConfigSection
          icon={Gift}
          title="Beneficios y Prestaciones"
          description="Vacaciones, décimo tercer mes y prima de antigüedad."
        >
          <div className="space-y-4">
            {/* Décimo Tercer Mes */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-white/[0.03]">
              <div>
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Décimo Tercer Mes</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Obligatorio por ley. Se paga en 3 partidas: 15 de abril, 15 de agosto y 15 de diciembre.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={benState.thirteenth_month}
                  onChange={e => setBenState((prev: typeof benState) => ({ ...prev, thirteenth_month: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
              </label>
            </div>

            {benState.thirteenth_month && (
              <div className="ml-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Método de cálculo
                </label>
                <select
                  value={benState.thirteenth_month_method}
                  onChange={e => setBenState((prev: typeof benState) => ({ ...prev, thirteenth_month_method: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="accrual">Acumulado (provisión mensual)</option>
                  <option value="lump_sum">Pago directo en fechas establecidas</option>
                </select>
              </div>
            )}

            {/* Vacaciones */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-white/[0.03]">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Vacaciones</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  30 días por cada 11 meses continuos de trabajo (Código de Trabajo de Panamá).
                </p>
                <div className="mt-2">
                  <NumberField
                    label="Días por año"
                    value={benState.vacation_days_per_year}
                    onChange={v => setBenState((prev: typeof benState) => ({ ...prev, vacation_days_per_year: v }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={benState.vacation_proportional}
                  onChange={e => setBenState((prev: typeof benState) => ({ ...prev, vacation_proportional: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-gray-500">Proporcional</span>
              </label>
            </div>

            {/* Prima de Antigüedad */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-white/[0.03]">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Prima de Antigüedad</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  1 semana de salario por cada año trabajado (Art. 224 Código de Trabajo).
                </p>
                <div className="mt-2">
                  <NumberField
                    label="Semanas por año"
                    value={benState.seniority_premium_weeks}
                    onChange={v => setBenState((prev: typeof benState) => ({ ...prev, seniority_premium_weeks: v }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={benState.seniority_premium}
                  onChange={e => setBenState((prev: typeof benState) => ({ ...prev, seniority_premium: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveBenefits}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Beneficios'}
            </button>
          </div>
        </ConfigSection>
      </div>
    </div>
  )
}

function ConfigSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20">
          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
      />
    </div>
  )
}
