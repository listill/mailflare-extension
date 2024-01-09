// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */

import type { Locales, Translations } from "./i18n-types";

import de from "./de";
import en from "./en";
import { initFormatters } from "./formatters";
import { loadedFormatters, loadedLocales, locales } from "./i18n-util";

const localeTranslations = {
  de,
  en,
};

export const loadLocale = (locale: Locales): void => {
  if (loadedLocales[locale]) return;

  loadedLocales[locale] = localeTranslations[locale] as unknown as Translations;
  loadFormatters(locale);
};

export const loadAllLocales = (): void => locales.forEach(loadLocale);

export const loadFormatters = (locale: Locales): void =>
  void (loadedFormatters[locale] = initFormatters(locale));
