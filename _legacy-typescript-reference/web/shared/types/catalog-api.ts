/**
 * Tipos TypeScript para las API routes de catálogos HKA
 */

// ============ LOCATIONS ============

export interface HKALocationResponse {
    id: string;
    code: string;
    provincia: string;
    distrito: string;
    corregimiento: string;
    fullName: string;
}

export interface LocationsAPIResponse {
    success: boolean;
    data: HKALocationResponse[];
    meta: {
        total: number;
        limit: number;
        hasMore: boolean;
    };
}

// ============ COUNTRIES ============

export interface HKACountryResponse {
    id: string;
    code: string;
    name: string;
    nameEs: string;
}

export interface CountriesAPIResponse {
    success: boolean;
    data: HKACountryResponse[];
    meta: {
        total: number;
        limit: number;
        hasMore: boolean;
    };
}

// ============ CPBS ============

export interface HKACPBSCategoryResponse {
    id: string;
    segment: string;
    family: string;
    segmentName: string;
    familyName: string;
}

export interface HKACPBSGrouped {
    segment: string;
    segmentName: string;
    families: Array<{
        family: string;
        familyName: string;
    }>;
}

export interface CPBSAPIResponse {
    success: boolean;
    data: {
        categories: HKACPBSCategoryResponse[];
        grouped: HKACPBSGrouped[];
    };
    meta: {
        total: number;
        limit: number;
        hasMore: boolean;
    };
}

// ============ ERROR RESPONSES ============

export interface APIErrorResponse {
    success: false;
    error: string;
    details?: any;
}

// ============ QUERY PARAMS ============

export interface LocationsQueryParams {
    q?: string;
    provincia?: string;
    code?: string;
    limit?: number;
}

export interface CountriesQueryParams {
    q?: string;
    code?: string;
    limit?: number;
}

export interface CPBSQueryParams {
    q?: string;
    segment?: string;
    family?: string;
    limit?: number;
}
