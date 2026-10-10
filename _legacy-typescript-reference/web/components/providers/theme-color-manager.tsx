'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

export function ThemeColorManager() {
    const { theme, resolvedTheme } = useTheme();

    useEffect(() => {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const activeTheme = resolvedTheme || theme;

        const lightColor = '#ffffff'; // White for light mode
        const darkColor = '#020617'; // Slate-950 for dark mode

        const color = activeTheme === 'dark' ? darkColor : lightColor;

        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', color);
        } else {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = color;
            document.head.appendChild(meta);
        }
    }, [theme, resolvedTheme]);

    return null;
}
