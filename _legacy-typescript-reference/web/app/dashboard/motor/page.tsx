import { redirect } from "next/navigation";

// Compat: el módulo se renombró a "Créditos". Mantenemos esta ruta para
// bookmarks legacy y evitar 404 en enlaces externos.
export default function MotorRedirectPage() {
    redirect("/dashboard/creditos");
}
