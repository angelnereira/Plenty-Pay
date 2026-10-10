"use client"

import { useState, useEffect } from "react"
import { CampaignForm } from "@/features/admin/crm/ui/campaign-form"
import { CampaignList } from "@/features/admin/crm/ui/campaign-list"
import { Mail, Loader2, RefreshCcw } from "lucide-react"

export default function CRMPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [campaigns, setCampaigns] = useState([])

    const fetchCampaigns = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/admin/crm/campaigns")
            const data = await res.json()
            if (data.success) {
                setCampaigns(data.data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-4">
                        <Mail className="h-10 w-10 text-primary" />
                        CRM & Marketing
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Gestiona y envía correos masivos a tus clientes de PlentyPay.
                    </p>
                </div>
                <button
                    onClick={fetchCampaigns}
                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <RefreshCcw className={`h-5 w-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Form */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <CampaignForm onComplete={fetchCampaigns} />
                    </div>
                </div>

                {/* Right: History */}
                <div className="lg:col-span-2">
                    {isLoading && campaigns.length === 0 ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <CampaignList campaigns={campaigns} />
                    )}
                </div>
            </div>
        </div>
    )
}
