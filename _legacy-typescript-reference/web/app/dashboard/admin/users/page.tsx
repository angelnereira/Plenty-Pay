import { redirect } from "next/navigation"

// Unified management moved to /dashboard/admin/clients
// This redirect ensures old links/bookmarks keep working
export default function AdminUsersRedirectPage() {
  redirect("/dashboard/admin/clients?tab=users")
}
