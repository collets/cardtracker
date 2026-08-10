"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { getCardTraderOriginalImageUrl } from "@/lib/cardtrader/images";
import { cn } from "@/lib/utils";

export function CardArt({
  src,
  alt,
  sizes,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const preferredSrc = src ? getCardTraderOriginalImageUrl(src) : null;
  const [failedPreferredSrc, setFailedPreferredSrc] = useState<string | null>(
    null,
  );
  const imageSrc =
    preferredSrc === failedPreferredSrc ? src : (preferredSrc ?? src);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/5",
        className,
      )}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={
            preferredSrc && preferredSrc !== src && imageSrc === preferredSrc
              ? () => setFailedPreferredSrc(preferredSrc)
              : undefined
          }
        />
      ) : (
        <div className="grid h-full min-h-40 place-items-center text-slate-600">
          <ImageIcon className="size-8" />
        </div>
      )}
    </div>
  );
}
