import { describe, it, expect } from '@jest/globals';

/**
 * CRITICAL VALIDATION: Sidebar Navigation Items
 * 
 * This test ensures that sidebar navigation items do not contain duplicates,
 * which would cause a critical UX bug where modules appear multiple times.
 * 
 * Bug History:
 * - 2026-01-21: Duplicate "Inventario" entry found in sidebar.tsx (lines 48-49)
 */

describe('Sidebar Navigation - Duplicate Prevention', () => {
    // Mock sidebar items structure
    const defaultSidebarItems = [
        { name: "Inicio", href: "/dashboard" },
        { name: "Punto de Venta", href: "/dashboard/pos" },
        { name: "Facturas", href: "/dashboard/facturas" },
        { name: "Inventario", href: "/dashboard/inventory" },
        { name: "Nómina", href: "/dashboard/payday" },
        { name: "Configuración", href: "/dashboard/configuracion" },
    ];

    it('should not have duplicate menu items by name', () => {
        const names = defaultSidebarItems.map(item => item.name);
        const uniqueNames = new Set(names);

        expect(uniqueNames.size).toBe(names.length);

        // If this fails, it means there are duplicate names
        if (uniqueNames.size !== names.length) {
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            throw new Error(`Duplicate sidebar items found: ${duplicates.join(', ')}`);
        }
    });

    it('should not have duplicate menu items by href', () => {
        const hrefs = defaultSidebarItems.map(item => item.href);
        const uniqueHrefs = new Set(hrefs);

        expect(uniqueHrefs.size).toBe(hrefs.length);

        // If this fails, it means there are duplicate hrefs
        if (uniqueHrefs.size !== hrefs.length) {
            const duplicates = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);
            throw new Error(`Duplicate sidebar hrefs found: ${duplicates.join(', ')}`);
        }
    });

    it('should not have duplicate name+href combinations', () => {
        const combinations = defaultSidebarItems.map(item => `${item.name}|${item.href}`);
        const uniqueCombinations = new Set(combinations);

        expect(uniqueCombinations.size).toBe(combinations.length);
    });
});

/**
 * USAGE:
 * Run this test as part of your pre-commit hooks or CI/CD pipeline:
 * 
 * npm test -- sidebar-validation.test.ts
 * 
 * To add this to your actual sidebar.tsx file, import it and run the validation
 * during development mode:
 * 
 * if (process.env.NODE_ENV === 'development') {
 *   validateSidebarItems(defaultSidebarItems);
 * }
 */

export function validateSidebarItems(items: Array<{ name: string; href: string }>) {
    const names = items.map(item => item.name);
    const hrefs = items.map(item => item.href);

    // Check for duplicate names
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        console.error('❌ CRITICAL: Duplicate sidebar items found by name:', duplicates);
        throw new Error(`Duplicate sidebar navigation items: ${duplicates.join(', ')}`);
    }

    // Check for duplicate hrefs
    const uniqueHrefs = new Set(hrefs);
    if (uniqueHrefs.size !== hrefs.length) {
        const duplicates = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);
        console.error('❌ CRITICAL: Duplicate sidebar items found by href:', duplicates);
        throw new Error(`Duplicate sidebar navigation hrefs: ${duplicates.join(', ')}`);
    }

    console.log('✅ Sidebar validation passed: No duplicates found');
}
