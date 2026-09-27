import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REGIONS, regionBySlug } from "./regions";

/**
 * Public Insights data (California EDD labor market information). No auth:
 * it's public data, and every query is built from a whitelisted region.
 * Each section loads independently so one slow dataset doesn't blank the page.
 */

const regionInput = z.object({ region: z.string().max(40).optional() });

const settle = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (e) {
    console.error("[insights]", e instanceof Error ? e.message : e);
    return null;
  }
};

export const getRegionInsights = createServerFn({ method: "GET" })
  .validator(regionInput)
  .handler(async ({ data }) => {
    const edd = await import("./edd.server");
    const region = regionBySlug(data.region);
    const state = REGIONS[0];
    const [unemployment, jobs, wages, outlook] = await Promise.all([
      settle(edd.getUnemployment(region, state)),
      settle(edd.getJobsTrend(region)),
      settle(edd.getWages(region)),
      settle(edd.getOutlook(region)),
    ]);
    return {
      region: { slug: region.slug, label: region.label, counties: region.counties },
      unemployment,
      jobs,
      wages,
      outlook,
    };
  });

export const searchOccupationPay = createServerFn({ method: "GET" })
  .validator(regionInput.extend({ q: z.string().trim().min(2).max(60) }))
  .handler(async ({ data }) => {
    const edd = await import("./edd.server");
    return edd.searchWages(regionBySlug(data.region), data.q);
  });
