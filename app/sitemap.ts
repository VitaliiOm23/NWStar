import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nwstardiagnostics.com";
  const routes = ["", "/services", "/mercedes-diagnostics", "/fleet-services", "/about", "/faq", "/contact", "/request-service", "/privacy", "/terms"];
  return routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: route === "" ? "weekly" : "monthly", priority: route === "" ? 1 : route === "/request-service" ? .9 : .7 }));
}
