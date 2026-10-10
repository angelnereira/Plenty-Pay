// Helper to serialize Prisma Decimal and other non-JSON values deep and reliably
export function jsonify(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // If it's an array, map over its elements
    if (Array.isArray(obj)) {
        return obj.map(jsonify);
    }

    // If it's a Date, convert to string
    if (obj instanceof Date) {
        return obj.toISOString();
    }

    // If it's a BigInt, convert to string
    if (typeof obj === 'bigint') {
        return obj.toString();
    }

    // If it's an object (but not null)
    if (typeof obj === 'object' && obj !== null) {
        // Robust Decimal detection (works even if class names are minified)
        const isDecimal = obj.constructor && (
            obj.constructor.name === 'Decimal' ||
            obj.constructor.name === 'd' ||
            (typeof obj.toDP === 'function' && typeof obj.toFixed === 'function' && typeof obj.toNumber === 'function')
        );

        if (isDecimal) {
            try {
                return Number(obj.toString());
            } catch (e) {
                return 0;
            }
        }

        // Handle objects with custom toJSON (like Decimal or others)
        if (typeof obj.toJSON === 'function') {
            const jsonValue = obj.toJSON();
            // If toJSON output is already a primitive, return it (after potential conversion)
            if (typeof jsonValue !== 'object' || jsonValue === null) {
                // If it's a number string from a Decimal, convert to number
                if (isDecimal && typeof jsonValue === 'string' && !isNaN(jsonValue as any)) {
                    return Number(jsonValue);
                }
                return jsonValue;
            }
            // Otherwise recurse
            return jsonify(jsonValue);
        }

        // Standard object: clone and recurse
        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = jsonify(obj[key]);
            }
        }
        return newObj;
    }

    return obj;
}
