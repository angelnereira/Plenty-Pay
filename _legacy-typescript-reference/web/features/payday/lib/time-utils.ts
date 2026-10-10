import {
    differenceInMinutes,
    startOfDay,
    addDays,
    setHours,
    setMinutes,
    isBefore,
    min,
    max,
    isAfter
} from "date-fns";

/**
 * Calcula con precisión atómica la división de horas diurnas y nocturnas.
 * Basado en el Código de Trabajo de Panamá:
 * - Diurno: 06:00 a 18:00
 * - Nocturno: 18:00 a 06:00
 * @param start Hora de entrada (Check-in)
 * @param end Hora de salida (Check-out)
 * @returns Objeto con horas decimales (ej: 2.5 = 2h 30m)
 */
export function calculateDayNightSplit(start: Date, end: Date): { dayHours: number, nightHours: number } {
    // 1. Validación de seguridad
    if (isAfter(start, end)) {
        console.error("Error Crítico: La hora de inicio es posterior al fin.");
        return { dayHours: 0, nightHours: 0 };
    }

    const totalMinutes = differenceInMinutes(end, start);
    let dayMinutes = 0;

    // 2. Iteramos por cada día que abarque el turno
    // (Normalmente es 1 día, o 2 si cruza la medianoche)
    let currentRefDate = startOfDay(start);
    const endDateRef = startOfDay(end);

    // Bucle para cubrir turnos que cruzan días (ej: Entra lunes, sale martes)
    while (currentRefDate <= endDateRef) {

        // Definir la "Ventana Diurna" para este día específico (6am - 6pm)
        const dayWindowStart = setMinutes(setHours(currentRefDate, 6), 0);  // 06:00:00
        const dayWindowEnd = setMinutes(setHours(currentRefDate, 18), 0);   // 18:00:00

        // 3. Algoritmo de Intersección
        // Calculamos el solapamiento entre el [Turno Real] y la [Ventana Diurna]

        // El inicio efectivo del solapamiento es el mayor de los dos inicios
        const overlapStart = max([start, dayWindowStart]);

        // El fin efectivo del solapamiento es el menor de los dos fines
        const overlapEnd = min([end, dayWindowEnd]);

        // Si hay solapamiento válido (inicio < fin), sumamos esos minutos como DIURNOS
        if (isBefore(overlapStart, overlapEnd)) {
            dayMinutes += differenceInMinutes(overlapEnd, overlapStart);
        }

        // Avanzar al siguiente día para verificar si el turno continuó
        currentRefDate = addDays(currentRefDate, 1);
    }

    // 4. Cálculo final (Lo que no es día, es noche por defecto)
    const nightMinutes = totalMinutes - dayMinutes;

    // 5. Conversión a Decimales (Ej: 90 min -> 1.5 horas)
    return {
        dayHours: Number((dayMinutes / 60).toFixed(2)),
        nightHours: Number((nightMinutes / 60).toFixed(2))
    };
}
