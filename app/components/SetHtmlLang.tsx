"use client";

import type { Locale } from "@/lib/i18n";
import { useEffect } from "react";

export default function SetHtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hant" : "en";
  }, [locale]);

  return null;
}
