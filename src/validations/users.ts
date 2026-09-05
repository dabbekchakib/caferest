import { z } from "zod";

/**
 * User-management validation schemas.
 * Messages carry i18n keys (relative to the `validation` namespace).
 */

export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .email({ message: "validation.invalidEmail" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type InviteUserValues = z.infer<typeof inviteUserSchema>;

export const setUserStatusSchema = z.object({
  userId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SetUserStatusValues = z.infer<typeof setUserStatusSchema>;

export const deleteUserSchema = z.object({
  userId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteUserValues = z.infer<typeof deleteUserSchema>;

export const addRoleAssignmentSchema = z.object({
  userId: z.string().uuid({ message: "validation.invalidValue" }),
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type AddRoleAssignmentValues = z.infer<typeof addRoleAssignmentSchema>;

export const removeRoleAssignmentSchema = z.object({
  userId: z.string().uuid({ message: "validation.invalidValue" }),
  roleId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RemoveRoleAssignmentValues = z.infer<
  typeof removeRoleAssignmentSchema
>;