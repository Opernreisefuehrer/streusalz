import type { MetadataRoute } from "next";
import { siteUrl, isLiveReady } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: isLiveReady() ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/danke"] } : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
