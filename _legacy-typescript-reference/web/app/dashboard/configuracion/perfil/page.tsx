import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import ProfileSettingsClient from "./profile-settings-client";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return <ProfileSettingsClient />;
}
