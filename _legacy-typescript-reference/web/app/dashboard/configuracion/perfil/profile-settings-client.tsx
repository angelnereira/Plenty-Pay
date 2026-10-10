"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, Camera, Lock, Save, Loader2, ArrowLeft,
  Eye, EyeOff, Shield, Trash2, CheckCircle2,
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  language: string;
  timezone: string;
  emailNotifications: boolean;
  ruc: string | null;
  dv: string | null;
  client: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
}

export default function ProfileSettingsClient() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [form, setForm] = useState({
    name: "",
    phone: "",
    ruc: "",
    dv: "",
    language: "es",
    timezone: "America/Panama",
    emailNotifications: true,
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await fetch("/api/settings/profile");
      if (!res.ok) throw new Error("Error cargando perfil");
      const data = await res.json();
      setProfile(data.profile);
      setForm({
        name: data.profile.name || "",
        phone: data.profile.phone || "",
        ruc: data.profile.ruc || "",
        dv: data.profile.dv || "",
        language: data.profile.language || "es",
        timezone: data.profile.timezone || "America/Panama",
        emailNotifications: data.profile.emailNotifications ?? true,
      });
    } catch {
      toast.error("Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setProfile((prev) => prev ? { ...prev, ...data.profile } : prev);
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no puede superar 2MB");
      return;
    }

    setSavingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/settings/profile/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir imagen");

      setProfile((prev) => prev ? { ...prev, image: data.image } : prev);
      toast.success("Imagen de perfil actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setSavingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    setSavingImage(true);
    try {
      const res = await fetch("/api/settings/profile/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      if (!res.ok) throw new Error("Error al eliminar imagen");
      setProfile((prev) => prev ? { ...prev, image: null } : prev);
      toast.success("Imagen de perfil eliminada");
    } catch {
      toast.error("Error al eliminar la imagen");
    } finally {
      setSavingImage(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar contraseña");
      toast.success("Contraseña actualizada correctamente");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) return null;

  const inputCls = "w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-800/80 dark:text-white transition-all placeholder:text-gray-400";
  const labelCls = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/dashboard/configuracion"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Configuración
        </Link>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <User className="h-7 w-7 text-violet-500" />
            Mi Perfil
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Administra tu información personal, foto de perfil y seguridad.
          </p>
        </div>

        {/* Profile Image Section */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Foto de Perfil / Logo
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                {profile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.image}
                    alt="Perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-gray-400" />
                )}
                {savingImage && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Esta imagen se usará en tus documentos PDF (órdenes de entrega, etc.) y como tu avatar en el sistema.
              </p>
              <p className="text-xs text-gray-400">Formatos: PNG, JPG, WebP. Máximo 2MB.</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingImage}
                  className="gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {profile.image ? "Cambiar" : "Subir imagen"}
                </Button>
                {profile.image && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveImage}
                    disabled={savingImage}
                    className="gap-1.5 text-red-500 hover:text-red-600 hover:border-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800/50 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === "profile"
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            <User className="h-4 w-4" /> Datos Personales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === "password"
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            <Lock className="h-4 w-4" /> Contraseña
          </button>
        </div>

        {/* Profile Data Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre Completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className={cn(inputCls, "opacity-60 cursor-not-allowed")}
                />
                <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar por seguridad.</p>
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="6000-0000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>RUC / Cédula</label>
                <input
                  type="text"
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  placeholder="8-888-888"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>DV</label>
                <input
                  type="text"
                  value={form.dv}
                  onChange={(e) => setForm({ ...form, dv: e.target.value })}
                  placeholder="00"
                  maxLength={2}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Idioma</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className={inputCls}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Zona Horaria</label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className={inputCls}
                >
                  <option value="America/Panama">Panamá (GMT-5)</option>
                  <option value="America/Bogota">Colombia (GMT-5)</option>
                  <option value="America/Mexico_City">México (GMT-6)</option>
                  <option value="America/New_York">Eastern US (GMT-5)</option>
                  <option value="America/Montevideo">Uruguay (GMT-3)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.emailNotifications}
                    onChange={(e) => setForm({ ...form, emailNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Recibir notificaciones por email</span>
                </label>
              </div>
            </div>

            {/* Organization info (read-only) */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">ORGANIZACIÓN</p>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl">
                {profile.client.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.client.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-violet-600" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile.client.name}</p>
                  <p className="text-xs text-gray-400">ID: {profile.client.slug}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cambiar Contraseña</h3>
                <p className="text-xs text-gray-500">Ingresa tu contraseña actual y la nueva contraseña.</p>
              </div>
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className={labelCls}>Contraseña Actual <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    placeholder="Tu contraseña actual"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Nueva Contraseña <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordForm.newPassword.length > 0 && passwordForm.newPassword.length < 8 && (
                  <p className="text-xs text-amber-600 mt-1">Mínimo 8 caracteres</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Confirmar Nueva Contraseña <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  placeholder="Repite la nueva contraseña"
                  className={inputCls}
                />
                {passwordForm.confirmPassword.length > 0 &&
                  passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
                {passwordForm.confirmPassword.length > 0 &&
                  passwordForm.newPassword === passwordForm.confirmPassword && (
                  <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Las contraseñas coinciden
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
