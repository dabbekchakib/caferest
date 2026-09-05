"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  CURRENT_ESTABLISHMENT_COOKIE,
  getAuthorizationContext,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import { ok, fail, type ActionResult } from "@/lib/authorization/action-result";

const setCurrentEstablishmentSchema = z.object({
  establishmentId: z.string().uuid(),
});

export async function setCurrentEstablishmentAction(input: {
  establishmentId: string;
}): Promise<ActionResult> {
  try {
    const parsed = setCurrentEstablishmentSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    const context = await getAuthorizationContext();
    const membership = context.memberships.find(
      (m) => m.id === parsed.data.establishmentId
    );
    if (!membership) {
      return fail(new AuthorizationError("INVALID_ESTABLISHMENT"));
    }

    const cookieStore = await cookies();
    cookieStore.set(CURRENT_ESTABLISHMENT_COOKIE, membership.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    await writeAudit({
      action: "establishment.switched",
      establishmentId: membership.id,
      entityType: "establishment",
      entityId: membership.id,
    });

    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}