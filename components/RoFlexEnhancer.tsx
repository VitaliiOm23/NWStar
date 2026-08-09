"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RoFlexEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const isRepairOrder = /^\/admin\/repair-orders\/[^/]+$/.test(pathname) || /^\/tech\/repair-orders\/[^/]+$/.test(pathname);
    if (!isRepairOrder) return;

    const relaxValidation = () => {
      document.querySelectorAll(".ro-detail-page form, .tech-ro-page form").forEach((form) => {
        (form as HTMLFormElement).noValidate = true;
        form.querySelectorAll("[required]").forEach((field) => field.removeAttribute("required"));
      });
    };

    relaxValidation();
    const observer = new MutationObserver(relaxValidation);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
