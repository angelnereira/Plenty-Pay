import { NextRequest, NextResponse } from 'next/server';
import { generateSimpleTemplate, generateDetailedTemplate, generateServicesTemplate } from '@/lib/utils/excel-templates';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const templateType = searchParams.get('type') || 'simple';

        let buffer: Buffer;
        let filename: string;

        switch (templateType) {
            case 'simple':
                buffer = await generateSimpleTemplate();
                filename = 'plantilla_factura_simple.xlsx';
                break;
            case 'detailed':
                buffer = await generateDetailedTemplate();
                filename = 'plantilla_factura_detallada.xlsx';
                break;
            case 'services':
                buffer = await generateServicesTemplate();
                filename = 'plantilla_factura_servicios.xlsx';
                break;
            default:
                return NextResponse.json({ error: 'Tipo de plantilla no válido' }, { status: 400 });
        }

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Error generating template:', error);
        return NextResponse.json({ error: 'Error al generar plantilla' }, { status: 500 });
    }
}
