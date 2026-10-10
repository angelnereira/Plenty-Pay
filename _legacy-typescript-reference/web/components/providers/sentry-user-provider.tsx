"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type UserData = {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  clientId?: string;
};

export function SentryUserProvider({ user }: { user?: UserData }) {
  useEffect(() => {
    if (user && user.id) {
      Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
        username: user.name || undefined,
        // Almacenamos campos custom (Multi-Tenant y Roles) en formato que Sentry entienda
        role: user.role,
        clientId: user.clientId,
      });
      // Set tags to globally segment issues by company
      if (user.clientId) {
        Sentry.setTag("company_id", user.clientId);
      }
      if (user.role) {
        Sentry.setTag("user_role", user.role);
      }
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return null;
}
