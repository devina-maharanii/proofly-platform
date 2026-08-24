"use client";

import { useReportWebVitals } from "next/web-vitals";

const endpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;

export function WebVitalsReporter() {
  useReportWebVitals(metric => {
    if (!endpoint || typeof navigator === "undefined") {
      return;
    }

    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
    });

    if (!navigator.sendBeacon(endpoint, payload)) {
      void fetch(endpoint, {
        body: payload,
        headers: { "content-type": "application/json" },
        keepalive: true,
        method: "POST",
      });
    }
  });

  return null;
}
