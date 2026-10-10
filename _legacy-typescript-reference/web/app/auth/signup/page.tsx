"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Building2,
  Briefcase,
  FileText,
  ShoppingBag,
  KeyRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthShell } from "@/components/auth/auth-shell"
import {
  MODULE_CATALOG,
  isModuleId,
  type ModuleCatalogEntry,
  type ModuleId,
} from "@/components/landing/modules-catalog"

type BillingCycle = "monthly" | "yearly"

function parseModuleIds(raw: string | null): ModuleId[] {
  if (!raw) return []
  const seen = new Set<ModuleId>()
  for (const chunk of raw.split(",")) {
    const trimmed = chunk.trim()
    if (isModuleId(trimmed)) seen.add(trimmed)
  }
  return Array.from(seen)
}

function parseBillingCycle(raw: string | null): BillingCycle {
  return raw === "yearly" ? "yearly" : "monthly"
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedModules = useMemo<ModuleCatalogEntry[]>(() => {
    const ids = parseModuleIds(searchParams.get("modules"))
    return ids
      .map((id) => MODULE_CATALOG.find((m) => m.id === id))
      .filter((m): m is ModuleCatalogEntry => Boolean(m))
  }, [searchParams])

  const billingCycle: BillingCycle = useMemo(
    () => parseBillingCycle(searchParams.get("billing")),
    [searchParams]
  )

  const total = useMemo(
    () =>
      selectedModules.reduce(
        (sum, m) =>
          sum + (billingCycle === "yearly" ? m.priceYearly : m.priceMonthly),
        0
      ),
    [selectedModules, billingCycle]
  )

  const hasBilling = selectedModules.some((m) => m.id === "billing")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    ruc: "",
    password: "",
    confirmPassword: "",
    hkaTokenUser: "",
    hkaTokenPassword: "",
    lastInvoiceNumber: "",
    acceptTerms: false,
  })

  const [isFirstTimeBilling, setIsFirstTimeBilling] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showHkaTokenPassword, setShowHkaTokenPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (selectedModules.length === 0) {
      router.replace("/#modulos")
    }
  }, [selectedModules, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value })
    setError("")
  }

  const validatePassword = (password: string) => {
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres."
    if (!/\d/.test(password)) return "La contraseña debe incluir al menos un número."
    if (!/[a-zA-Z]/.test(password)) return "La contraseña debe incluir al menos una letra."
    if (!/[^A-Za-z\d\s]/.test(password))
      return "La contraseña debe incluir al menos un símbolo (!@#$...)."
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (selectedModules.length === 0) {
      setError("Debes seleccionar al menos un módulo.")
      return
    }

    if (!formData.acceptTerms) {
      setError("Debes aceptar los Términos y Condiciones")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (!formData.ruc.trim()) {
      setError("El RUC es obligatorio")
      return
    }

    if (hasBilling) {
      if (!formData.hkaTokenUser.trim()) {
        setError("El Token Empresa de HKA es obligatorio para el módulo de Facturación Fiscal.")
        return
      }
      if (!formData.hkaTokenPassword.trim()) {
        setError("El Token Password de HKA es obligatorio para el módulo de Facturación Fiscal.")
        return
      }
      if (!isFirstTimeBilling) {
        const parsed = parseInt(formData.lastInvoiceNumber, 10)
        if (!formData.lastInvoiceNumber.trim() || isNaN(parsed) || parsed < 1) {
          setError("Ingresa el número de tu última factura emitida para continuar la secuencia correctamente.")
          return
        }
      }
    }

    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        modules: selectedModules.map((m) => m.id),
        billingCycle,
        ...(hasBilling && {
          hkaTokenUser: formData.hkaTokenUser,
          hkaTokenPassword: formData.hkaTokenPassword,
          ...(!isFirstTimeBilling && formData.lastInvoiceNumber && {
            lastInvoiceNumber: parseInt(formData.lastInvoiceNumber, 10),
          }),
        }),
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar usuario")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell
        side="minimal"
        title="¡Solicitud recibida!"
        subtitle="Tu cuenta ha sido creada y está pendiente de aprobación."
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Una vez aprobada, recibirás un correo con el enlace de acceso a tu
            panel.
          </p>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center justify-center w-full h-11 rounded-md text-sm font-semibold transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Volver al inicio
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (selectedModules.length === 0) {
    return (
      <AuthShell
        side="minimal"
        title="Selecciona tus módulos"
        subtitle="Debes elegir al menos un módulo para crear tu cuenta."
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <ShoppingBag className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Arma tu plan combinando los módulos que tu empresa necesita.
          </p>
          <Link
            href="/#modulos"
            className={cn(
              "inline-flex items-center justify-center w-full h-11 rounded-md text-sm font-semibold transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Ver módulos
          </Link>
        </div>
      </AuthShell>
    )
  }

  const inputClasses = cn(
    "flex h-11 w-full rounded-md px-3 pl-10 text-sm transition-all",
    "bg-background border border-input text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/40"
  )

  const cycleLabel = billingCycle === "yearly" ? "anual" : "mensual"
  const cycleLabelShort = billingCycle === "yearly" ? "año" : "mes"

  return (
    <AuthShell
      side="branding"
      title="Crear cuenta"
      subtitle="Regístrate y activa tu panel empresarial."
      footerSlot={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link
            href="/auth/signin"
            className="text-primary hover:underline font-medium"
          >
            Inicia sesión
          </Link>
        </>
      }
    >
      <div className="mb-5 rounded-xl border border-primary/15 bg-primary/5 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-primary/10">
          <div className="flex items-center gap-2 min-w-0">
            <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
              Tu plan
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground uppercase whitespace-nowrap flex-shrink-0">
            {cycleLabel === "anual" ? "Anual" : "Mensual"}
          </span>
        </div>
        <ul className="divide-y divide-primary/10">
          {selectedModules.map((mod) => {
            const price =
              billingCycle === "yearly" ? mod.priceYearly : mod.priceMonthly
            const Icon = mod.icon
            return (
              <li
                key={mod.id}
                className="flex items-center gap-2 px-3 py-2.5"
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
                    mod.bgColor
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", mod.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {mod.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {mod.subtitle}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 pl-1">
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    ${formatPrice(price)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    /{cycleLabelShort}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between px-3 py-3 border-t border-primary/15 bg-primary/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Total {cycleLabelShort}
          </span>
          <span className="text-base font-black text-foreground tabular-nums">
            ${formatPrice(total)}
          </span>
        </div>
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-primary/10">
          <Link
            href="/#modulos"
            className="text-primary hover:underline font-medium"
          >
            ← Cambiar módulos
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="name">
            Nombre completo
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={handleChange}
              className={inputClasses}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              value={formData.email}
              onChange={handleChange}
              className={inputClasses}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="companyName"
            >
              Razón social
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="companyName"
                name="companyName"
                type="text"
                autoComplete="organization"
                placeholder="Mi Empresa S.A."
                value={formData.companyName}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ruc">
              RUC
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="ruc"
                name="ruc"
                type="text"
                placeholder="8-NT-1-123456"
                value={formData.ruc}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
          </div>
        </div>

        {hasBilling && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold text-foreground">
                Credenciales HKA — Facturación Fiscal
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Necesarios para emitir facturas electrónicas certificadas por la DGI. Los obtienes en el portal de HKA Panamá.
            </p>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="hkaTokenUser">
                Token empresa
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="hkaTokenUser"
                  name="hkaTokenUser"
                  type="text"
                  placeholder="Token empresa proporcionado por HKA"
                  value={formData.hkaTokenUser}
                  onChange={handleChange}
                  className={inputClasses}
                  required={hasBilling}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="hkaTokenPassword">
                Token password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="hkaTokenPassword"
                  name="hkaTokenPassword"
                  type={showHkaTokenPassword ? "text" : "password"}
                  placeholder="Contraseña del token HKA"
                  value={formData.hkaTokenPassword}
                  onChange={handleChange}
                  className={cn(inputClasses, "pr-10")}
                  required={hasBilling}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowHkaTokenPassword(!showHkaTokenPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showHkaTokenPassword ? "Ocultar token password" : "Mostrar token password"}
                >
                  {showHkaTokenPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-yellow-500/15 pt-3 space-y-2.5">
              <p className="text-sm font-medium text-foreground">
                ¿Es la primera vez que facturarás electrónicamente?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFirstTimeBilling(true)}
                  className={cn(
                    "flex-1 h-10 rounded-md text-sm font-semibold border transition-all",
                    isFirstTimeBilling
                      ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
                      : "bg-background border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sí, es mi primera vez
                </button>
                <button
                  type="button"
                  onClick={() => setIsFirstTimeBilling(false)}
                  className={cn(
                    "flex-1 h-10 rounded-md text-sm font-semibold border transition-all",
                    !isFirstTimeBilling
                      ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
                      : "bg-background border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  Ya he facturado antes
                </button>
              </div>

              {!isFirstTimeBilling && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="lastInvoiceNumber">
                    Número de tu última factura emitida
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="lastInvoiceNumber"
                      name="lastInvoiceNumber"
                      type="number"
                      min="1"
                      placeholder="Ej. 1500"
                      value={formData.lastInvoiceNumber}
                      onChange={handleChange}
                      className={inputClasses}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El sistema continuará la secuencia a partir de este número.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="password"
          >
            Contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={formData.password}
              onChange={handleChange}
              className={cn(inputClasses, "pr-10")}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            8+ caracteres con números, letras y un símbolo.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="confirmPassword"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repite tu contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={cn(inputClasses, "pr-10")}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={
                showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer"
            required
          />
          <label
            htmlFor="acceptTerms"
            className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none"
          >
            He leído y acepto los{" "}
            <Link
              href="/terms"
              target="_blank"
              className="text-primary hover:underline"
            >
              Términos y Condiciones
            </Link>{" "}
            y la{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="text-primary hover:underline"
            >
              Política de Privacidad
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full h-11 rounded-md font-semibold text-primary-foreground transition-all duration-200 flex items-center justify-center gap-2",
            "bg-primary hover:bg-primary/90 shadow-sm hover:shadow",
            isLoading && "opacity-70 cursor-wait"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando cuenta…
            </>
          ) : (
            `Confirmar y crear cuenta · $${formatPrice(total)}/${cycleLabel}`
          )}
        </button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  )
}
