import type { MetadataRoute } from "next";
import { siteUrl, isSiteIndexable } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: isSiteIndexable() ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/danke"] } : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
