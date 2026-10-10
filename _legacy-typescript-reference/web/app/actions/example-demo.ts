'use server';

/**
 * DEMO: Server Actions usando Safe Action Pattern
 * 
 * Este archivo demuestra cómo usar el patrón Safe Action para:
 * - Manejo centralizado de errores
 * - Logging controlado por DEBUG_MODE
 * - Respuestas estandarizadas
 * - Timing de performance
 */

import { safeAction, safeFormAction, type SafeActionResponse } from '@/lib/safe-action';
import { auth } from '@core/auth';

// ============================================
// EJEMPLO 1: Acción Simple con Input Tipado
// ============================================

interface CalculateInput {
    a: number;
    b: number;
    operation: 'add' | 'subtract' | 'multiply' | 'divide';
}

interface CalculateOutput {
    result: number;
    formula: string;
}

/**
 * Ejemplo de cálculo matemático
 * Demuestra: input tipado, validación, error handling
 */
export const calculateDemo = safeAction<CalculateInput, CalculateOutput>(
    async (input) => {
        const { a, b, operation } = input;

        // Simulamos un delay para ver el timing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Validación de negocio
        if (operation === 'divide' && b === 0) {
            throw new Error('No se puede dividir por cero');
        }

        let result: number;
        let formula: string;

        switch (operation) {
            case 'add':
                result = a + b;
                formula = `${a} + ${b} = ${result}`;
                break;
            case 'subtract':
                result = a - b;
                formula = `${a} - ${b} = ${result}`;
                break;
            case 'multiply':
                result = a * b;
                formula = `${a} × ${b} = ${result}`;
                break;
            case 'divide':
                result = a / b;
                formula = `${a} ÷ ${b} = ${result}`;
                break;
        }

        return { result, formula };
    },
    {
        context: 'CalculateDemo',
        logInput: true,
        logOutput: true
    }
);

// ============================================
// EJEMPLO 2: Acción con Autenticación
// ============================================

interface UserProfileOutput {
    id: string;
    email: string;
    name: string;
}

/**
 * Obtiene perfil del usuario autenticado
 * Demuestra: autenticación, errores de autorización
 */
export const getUserProfileDemo = safeAction<void, UserProfileOutput>(
    async () => {
        // Verificar autenticación
        const session = await auth();

        if (!session?.user) {
            throw new Error('Usuario no autenticado');
        }

        // Simular consulta a BD
        await new Promise(resolve => setTimeout(resolve, 200));

        return {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.name || 'Usuario'
        };
    },
    {
        context: 'GetUserProfileDemo',
        logInput: false, // No hay input sensible
        logOutput: false // No loguear datos sensibles
    }
);

// ============================================
// EJEMPLO 3: Acción con FormData
// ============================================

interface FormSubmitOutput {
    message: string;
    submittedAt: string;
}

/**
 * Procesa un formulario
 * Demuestra: manejo de FormData, validación
 */
export const submitFormDemo = safeFormAction<FormSubmitOutput>(
    async (formData) => {
        const name = formData.get('name')?.toString();
        const email = formData.get('email')?.toString();

        // Validación
        if (!name || name.length < 3) {
            throw new Error('Nombre debe tener al menos 3 caracteres');
        }

        if (!email || !email.includes('@')) {
            throw new Error('Email inválido');
        }

        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            message: `Formulario de ${name} enviado exitosamente`,
            submittedAt: new Date().toISOString()
        };
    },
    {
        context: 'SubmitFormDemo',
        logInput: true,
        logOutput: true
    }
);

// ============================================
// EJEMPLO 4: Acción que Siempre Falla
// ============================================

/**
 * Acción que falla intencionalmente
 * Demuestra: manejo de errores, sanitización de mensajes
 */
export const failingActionDemo = safeAction<void, never>(
    async () => {
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 50));

        // Lanzar un error
        throw new Error('Esta acción falla intencionalmente para probar el error handling');
    },
    {
        context: 'FailingActionDemo'
    }
);

// ============================================
// EJEMPLO 5: Uso Desde el Cliente
// ============================================

/**
 * CÓDIGO DE EJEMPLO PARA USO EN COMPONENTES CLIENT:
 *
 * 'use client';
 *
 * import { calculateDemo } from '@/actions/example-demo';
 * import { toast } from 'sonner';
 *
 * export function DemoComponent() {
 *   const handleCalculate = async () => {
 *     const result = await calculateDemo({
 *       a: 10,
 *       b: 5,
 *       operation: 'add'
 *     });
 *
 *     if (result.success) {
 *       toast.success(result.data.formula);
 *       console.log('Execution time:', result.meta?.executionTime);
 *     } else {
 *       toast.error(result.error);
 *     }
 *   };
 *
 *   return <button onClick={handleCalculate}>Calculate</button>;
 * }
 */

// ============================================
// TIPOS DE RESPUESTA PARA REFERENCE
// ============================================

/**
 * Todos los Safe Actions retornan este formato:
 * 
 * interface SafeActionResponse<T> {
 *   success: boolean;
 *   data: T | null;
 *   error: string | null;
 *   meta?: {
 *     executionTime?: number;
 *     timestamp?: string;
 *     context?: string;
 *   };
 * }
 * 
 * EJEMPLOS DE USO:
 * 
 * // ✅ Success case
 * {
 *   success: true,
 *   data: { result: 15, formula: "10 + 5 = 15" },
 *   error: null,
 *   meta: {
 *     executionTime: 102.34,
 *     timestamp: "2024-01-01T12:00:00Z",
 *     context: "CalculateDemo"
 *   }
 * }
 * 
 * // ❌ Error case (con DEBUG_MODE=true)
 * {
 *   success: false,
 *   data: null,
 *   error: "No se puede dividir por cero",
 *   meta: {
 *     executionTime: 101.56,
 *     timestamp: "2024-01-01T12:00:00Z",
 *     context: "CalculateDemo"
 *   }
 * }
 * 
 * // ❌ Error case (con DEBUG_MODE=false - PRODUCCIÓN)
 * {
 *   success: false,
 *   data: null,
 *   error: "Ocurrió un error. Por favor, intenta nuevamente.",
 *   meta: {
 *     executionTime: 101.56,
 *     timestamp: "2024-01-01T12:00:00Z",
 *     context: "CalculateDemo"
 *   }
 * }
 */
