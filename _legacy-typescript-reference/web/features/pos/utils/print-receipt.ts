export const printReceipt = async (contentId: string) => {
    const content = document.getElementById(contentId);
    if (!content) return;

    // Mobile Share API Support
    if (typeof navigator.share === 'function' && /android|iphone|ipad/i.test(navigator.userAgent)) {
        try {
            // Can't easily share HTML as file without generation, 
            // but we can try to share text or just print which on mobile often allows PDF save/share
            // For now, let's stick to window.print() but optimized.

            // Note: True PDF generation client-side is heavy (jspdf/html2canvas).
            // We'll rely on browser print for MVP.
        } catch (e) {
            console.error("Share failed", e);
        }
    }

    const printWindow = window.open('', '', 'height=600,width=400');
    if (!printWindow) return;

    // Get all style sheets to ensure Tailwind classes work
    const styles = Array.from(document.styleSheets)
        .map(styleSheet => {
            try {
                return Array.from(styleSheet.cssRules)
                    .map(rule => rule.cssText)
                    .join('');
            } catch (e) {
                return '';
            }
        })
        .join('');

    printWindow.document.write('<html><head><title>Imprimir Recibo</title>');

    // Inject styles
    printWindow.document.write('<style>');
    printWindow.document.write(styles);
    // Add print specific overrides
    printWindow.document.write(`
        @media print {
            body { -webkit-print-color-adjust: exact; margin: 0; padding: 0.5cm; }
            @page { size: auto; margin: 0mm; }
        }
        body { background: white; }
    `);
    printWindow.document.write('</style>');

    // Inject Tailwind CDN as backup if local styles fail
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');

    printWindow.document.write('</head><body>');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</body></html>');

    printWindow.document.close();
    printWindow.focus();

    // Delay to ensure styles render and scripts load
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};
