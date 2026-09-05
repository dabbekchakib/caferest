import { z } from "zod";

/**
 * Role-management validation schemas.
 * Messages carry i18n keys (relative to the `validation` namespace).
 */

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(60, { message: "validation.maxLength" }),
  code: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(40, { message: "validation.maxLength" })
    .regex(/^[a-z][a-z0-9_]*$/, { message: "validation.regex" }),
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  level: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(1, { message: "validation.minValue" })
    .max(99, { message: "validation.maxValue" })
    .optional(),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type CreateRoleValues = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(60, { message: "validation.maxLength" })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  level: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(1, { message: "validation.minValue" })
    .max(99, { message: "validation.maxValue" })
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoleValues = z.infer<typeof updateRoleSchema>;

export const duplicateRoleSchema = z.object({
  sourceRoleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(60, { message: "validation.maxLength" }),
  code: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(40, { message: "validation.maxLength" })
    .regex(/^[a-z][a-z0-9_]*$/, { message: "validation.regex" }),
});

export type DuplicateRoleValues = z.infer<typeof duplicateRoleSchema>;

export const setRoleStatusSchema = z.object({
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SetRoleStatusValues = z.infer<typeof setRoleStatusSchema>;

export const deleteRoleSchema = z.object({
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteRoleValues = z.infer<typeof deleteRoleSchema>;

export const setRolePermissionsSchema = z.object({
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  permissionIds: z.array(z.string().uuid({ message: "validation.invalidValue" })),
});

export type SetRolePermissionsValues = z.infer<
  typeof setRolePermissionsSchema
>;