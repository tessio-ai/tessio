// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { fieldWidth } from './schema-definition';

/** The portal look for a single form. */
export const portalTheme = z.object({
  accent: z.string(),
  logo: z.string().optional(),
  layout: z.enum(['single', 'card']).default('single'),
  bg: z.enum(['plain', 'tint']).default('plain'),
  font: z.enum(['sans', 'serif']).default('sans'),
  showTess: z.boolean().default(true),
  headline: z.string(),
  intro: z.string().optional(),
  success: z.string().optional(),
});
export type PortalTheme = z.infer<typeof portalTheme>;

/** A schema field as arranged on a form (references a schema field by key). */
export const formFieldRef = z.object({
  fieldKey: z.string().min(1),
  width: fieldWidth.default('full'),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  requiredAtIntake: z.boolean().optional(),
});
export type FormFieldRef = z.infer<typeof formFieldRef>;

export const formSection = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  fields: z.array(formFieldRef),
});
export type FormSection = z.infer<typeof formSection>;

export const formDefinition = z.object({ sections: z.array(formSection) });
export type FormDefinition = z.infer<typeof formDefinition>;

export const portalCategory = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  order: z.number().int().nonnegative(),
  visible: z.boolean().default(true),
});
export type PortalCategory = z.infer<typeof portalCategory>;

export const heroPreset = z.enum(['spotlight', 'editorial', 'aurora', 'classic']);
export type HeroPreset = z.infer<typeof heroPreset>;

export const heroPill = z.object({
  label: z.string().min(1),
  formKey: z.string().optional(),
  categoryKey: z.string().optional(),
}).refine((p) => !!p.formKey || !!p.categoryKey, { message: 'A pill needs a form or category target' });
export type HeroPill = z.infer<typeof heroPill>;

export const portalHero = z.object({
  preset: heroPreset.default('spotlight'),
  eyebrow: z.string().optional(),
  pills: z.array(heroPill).default([]),
  showSearch: z.boolean().default(true),
});
export type PortalHero = z.infer<typeof portalHero>;

export const portalCatalogConfig = z.object({
  sectionStyle: z.enum(['band', 'plain']).default('band'),
  cardStyle: z.enum(['comfortable', 'compact']).default('comfortable'),
  columns: z.union([z.literal('auto'), z.literal(2), z.literal(3), z.literal(4)]).default('auto'),
});
export type PortalCatalogConfig = z.infer<typeof portalCatalogConfig>;

export const portalSettings = z.object({
  brandName: z.string(),
  logo: z.string().optional(),
  heroHeadline: z.string(),
  heroIntro: z.string().optional(),
  accent: z.string(),
  showTess: z.boolean().default(true),
  categories: z.array(portalCategory).default([]),
  hero: portalHero.default({}),
  catalog: portalCatalogConfig.default({}),
});
export type PortalSettings = z.infer<typeof portalSettings>;
