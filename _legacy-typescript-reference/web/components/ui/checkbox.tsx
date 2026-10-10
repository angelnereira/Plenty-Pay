"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, onCheckedChange, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (onCheckedChange) {
                onCheckedChange(e.target.checked)
            }
            if (onChange) {
                onChange(e)
            }
        }

        return (
            <label className="relative flex items-center justify-center cursor-pointer">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    onChange={handleChange}
                    ref={ref}
                    {...props}
                />
                <div className={cn(
                    "h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    "bg-background peer-checked:bg-primary peer-checked:text-primary-foreground",
                    className
                )}>
                    <Check className="h-3 w-3 hidden peer-checked:block pointer-events-none text-current" />
                </div>
            </label>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
