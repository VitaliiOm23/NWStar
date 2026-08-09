"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function replacePrefix(element: Element | null, from: string, to: string) {
  if (!element) return;
  const current = element.textContent || "";
  if (current.startsWith(from)) element.textContent = `${to}${current.slice(from.length)}`;
}

export function RoFlexEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const isOwnerRepairOrder = /^\/admin\/repair-orders\/[^/]+$/.test(pathname);
    const isTechRepairOrder = /^\/tech\/repair-orders\/[^/]+$/.test(pathname);
    if (!isOwnerRepairOrder && !isTechRepairOrder) return;

    const enhance = () => {
      document.querySelectorAll(".ro-detail-page form, .tech-ro-page form").forEach((form) => {
        (form as HTMLFormElement).noValidate = true;
        form.querySelectorAll("[required]").forEach((field) => field.removeAttribute("required"));
      });

      if (!isOwnerRepairOrder) return;

      const railTitle = document.querySelector(".ro-line-rail-head span");
      if (railTitle) railTitle.textContent = "Jobs";
      const railHelp = document.querySelector(".ro-line-rail-head small");
      if (railHelp) railHelp.textContent = "One job = one issue or service";

      document.querySelectorAll(".ro-line-rail nav a > div:first-child > span").forEach((element) => replacePrefix(element, "Line ", "Job "));
      replacePrefix(document.querySelector(".ro-line-focus-head > div:first-child > span"), "Line ", "Job ");
      document.querySelectorAll(".ro-approval-card > header > div:first-child > span").forEach((element) => replacePrefix(element, "Line ", "Job "));
      document.querySelectorAll(".ro-estimate-lines span").forEach((element) => replacePrefix(element, "Line ", "Job "));

      const addSummary = document.querySelector(".ro-add-line-simple summary");
      if (addSummary) addSummary.textContent = "+ Add job";
      const addButton = document.querySelector(".ro-add-line-simple button[type='submit']");
      if (addButton) addButton.textContent = "Add job";

      const emptyHeading = document.querySelector(".ro-workspace-empty h2");
      if (emptyHeading) emptyHeading.textContent = "Add the first job.";
      const emptyCopy = document.querySelector(".ro-workspace-empty p");
      if (emptyCopy) emptyCopy.textContent = "A job is one customer concern, diagnosis, or service you want to track separately.";

      const priceLabel = document.querySelector(".ro-section-bar span");
      if (priceLabel) priceLabel.textContent = "Price";
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
