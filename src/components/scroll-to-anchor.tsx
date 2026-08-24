"use client";

import { useEffect } from "react";

export function ScrollToAnchor({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView();
    });
  }, [id]);

  return null;
}
