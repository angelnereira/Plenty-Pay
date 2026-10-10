import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  crop?: string;
}

/**
 * Renders a product image. Handles both:
 * - Cloudinary public IDs (legacy) → uses Cloudinary URL transformation
 * - Data URLs (base64) → renders directly as <img> (with unoptimized Image)
 * - Full URLs → renders directly as <img> (with unoptimized Image)
 */
export function ProductImage({ src, alt, width = 200, height = 200, className }: ProductImageProps) {
  if (!src) return null;

  // Data URL or full URL — render with next/image (unoptimized for data/external)
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn("object-cover", className)}
        unoptimized
      />
    );
  }

  // Cloudinary public ID — construct URL if cloud name exists
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  const transform = `c_thumb,w_${width},h_${height}`;
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${src}`;

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-cover", className)}
      unoptimized
    />
  );
}
