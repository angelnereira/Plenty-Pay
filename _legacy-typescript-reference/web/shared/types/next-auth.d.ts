import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      clientId?: string
      approvalStatus?: string
      facturacionEnabled?: boolean
      inventoryEnabled?: boolean
      posEnabled?: boolean
      paydayEnabled?: boolean
      logisticsEnabled?: boolean
      creditosEnabled?: boolean
    }
  }

  interface User {
    role: string
    clientId?: string
    approvalStatus?: string
    facturacionEnabled?: boolean
    inventoryEnabled?: boolean
    posEnabled?: boolean
    paydayEnabled?: boolean
    logisticsEnabled?: boolean
    creditosEnabled?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    clientId?: string
    approvalStatus?: string
    facturacionEnabled?: boolean
    inventoryEnabled?: boolean
    posEnabled?: boolean
    paydayEnabled?: boolean
    logisticsEnabled?: boolean
    creditosEnabled?: boolean
  }
}
