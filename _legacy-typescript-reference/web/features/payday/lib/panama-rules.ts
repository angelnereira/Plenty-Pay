import { calculateDayNightSplit } from "./time-utils";

/**
 * CONSTANTES LEGALES - CÓDIGO DE TRABAJO DE PANAMÁ
 * Fuentes: Artículos 30, 31, 33, 36 del Código de Trabajo.
 */

// Límites de Jornada Ordinaria (en horas)
export const LEGAL_LIMITS = {
    DIURNA_MAX_HOURS: 8,
    MIXTA_MAX_HOURS: 7.5,
    NOCTURNA_MAX_HOURS: 7,

    // Límites de Horas Extras (Art. 36)
    MAX_DAILY_OVERTIME: 3,
    MAX_WEEKLY_OVERTIME: 9,
};

// Recargos sobre el salario por hora (Art. 33)
export const SURCHARGES = {
    NORMAL: 1.0,           // Hora base
    OVERTIME_DIURNA: 1.25, // 25% recargo
    OVERTIME_NOCTURNA: 1.50, // 50% recargo (o mixta excedida)
    OVERTIME_MIXTA: 1.50,  // Tratada generalmente como nocturna si excede
    EXTENSION_NOCTURNA: 1.75, // 75% (Prolongación de jornada nocturna)
    SUNDAY_HOLIDAY: 1.50,   // 50% recargo por día de descanso/fiesta
};

// Definición de rangos horarios fijos
const TIME_RANGES = {
    DAY_START: 6, // 6:00 AM
    NIGHT_START: 18, // 6:00 PM (18:00)
};

export type ShiftType = "DIURNA" | "NOCTURNA" | "MIXTA";

export interface WorkShiftAnalysis {
    shiftType: ShiftType;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    surchargeRate: number; // El multiplicador base para las horas extras
    isLegal: boolean;
    violationReason?: string;
    dayHours: number;
    nightHours: number;
}

/**
 * Analiza un turno de trabajo y determina su tipo legal y horas extras.
 * * Regla de Oro (Art. 30):
 * - Diurna: 6am a 6pm.
 * - Nocturna: 6pm a 6am.
 * - Mixta: Comprende horas de ambos periodos. 
 * CRÍTICO: Si la mixta tiene >3 horas nocturnas, se considera NOCTURNA legalmente.
 */
export function analyzeShift(
    checkIn: Date,
    checkOut: Date,
    isHolidayOrSunday: boolean = false
): WorkShiftAnalysis {

    // 1. Calcular duración total en horas (decimal)
    // Utilizamos el cálculo de time-utils para consistencia, o simple math si calculateDayNightSplit ya lo hace
    // calculateDayNightSplit retorna horas ya, sumarlas es seguro.
    const { dayHours, nightHours } = calculateDayNightSplit(checkIn, checkOut);
    const totalHours = Number((dayHours + nightHours).toFixed(2));

    // 2. Determinar el Tipo de Jornada (ShiftType)
    let shiftType: ShiftType = "DIURNA";
    let maxRegularHours = LEGAL_LIMITS.DIURNA_MAX_HOURS;

    if (nightHours === 0 && dayHours > 0) {
        shiftType = "DIURNA";
        maxRegularHours = LEGAL_LIMITS.DIURNA_MAX_HOURS; // 8h
    } else if (dayHours === 0 && nightHours > 0) {
        shiftType = "NOCTURNA";
        maxRegularHours = LEGAL_LIMITS.NOCTURNA_MAX_HOURS; // 7h
    } else {
        // Es MIXTA, pero aplicamos la regla de la excepción nocturna
        if (nightHours > 3) {
            shiftType = "NOCTURNA"; // Legalmente se convierte en nocturna
            maxRegularHours = LEGAL_LIMITS.NOCTURNA_MAX_HOURS; // 7h
        } else {
            shiftType = "MIXTA";
            maxRegularHours = LEGAL_LIMITS.MIXTA_MAX_HOURS; // 7.5h
        }
    }

    // 3. Calcular Horas Ordinarias vs Extras
    let regularHours = totalHours;
    let overtimeHours = 0;

    if (totalHours > maxRegularHours) {
        regularHours = maxRegularHours;
        overtimeHours = totalHours - maxRegularHours;
    }

    // 4. Determinar Tasa de Recargo (Surcharge Rate)
    let surchargeRate = SURCHARGES.NORMAL;

    if (overtimeHours > 0) {
        if (isHolidayOrSunday) {
            // Prioridad a domingo/feriado sobre tipo de jornada para el recargo base
            // NOTA: En Panamá, recargos de horas extras se acumulan sobre el recargo de domingo?
            // Usualmente es: Hora ordinaria domingo = 1.5. Hora extra domingo = Cálculos específicos.
            // Aquí simplificamos para la detección inicial.
            surchargeRate = SURCHARGES.SUNDAY_HOLIDAY;
        } else {
            switch (shiftType) {
                case "DIURNA":
                    surchargeRate = SURCHARGES.OVERTIME_DIURNA; // 1.25
                    break;
                case "NOCTURNA":
                    surchargeRate = SURCHARGES.OVERTIME_NOCTURNA; // 1.50
                    break;
                case "MIXTA":
                    surchargeRate = SURCHARGES.OVERTIME_MIXTA; // 1.50 (generalmente)
                    break;
            }

            // Regla del 75%: Si es jornada nocturna y se extiende (Prolongación)
            // Esta lógica requiere saber si las horas extras ocurrieron en la mañana siguiente
            // Se deja preparada para expansión futura.
        }
    }

    // 5. Validación Legal (El "Semáforo" de Cumplimiento)
    let isLegal = true;
    let violationReason = undefined;

    // Límite de 3 horas extras diarias
    if (overtimeHours > LEGAL_LIMITS.MAX_DAILY_OVERTIME) {
        isLegal = false;
        violationReason = `EXCESO_LEGAL: Las horas extras (${overtimeHours.toFixed(2)}) exceden el límite diario de 3 horas.`;
    }

    return {
        shiftType,
        totalHours,
        regularHours,
        overtimeHours,
        surchargeRate,
        isLegal,
        violationReason,
        dayHours,
        nightHours
    };
}

// Backward compatibility helpers for existing code calling simpler functions
export function determineShiftType(checkIn: Date, checkOut?: Date): ShiftType { // checkOut is generally needed now
    if (!checkOut) return 'DIURNA'; // Fallback
    const result = analyzeShift(checkIn, checkOut);
    return result.shiftType;
}

export function calculateShiftHours(checkIn: Date, checkOut: Date) {
    const result = analyzeShift(checkIn, checkOut);
    return {
        regular: result.regularHours,
        overtime: result.overtimeHours, // Simplified aggregation
        totalHours: result.totalHours,
        shiftType: result.shiftType
    };
}
