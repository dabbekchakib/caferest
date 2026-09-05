import { test } from "node:test";
import assert from "node:assert/strict";
import type { AuthClientLike, UserProfile } from "../src/lib/auth/auth-types";
import {
  exchangeCodeForSession,
  getCurrentProfile,
  getCurrentUser,
  isProfileActive,
  resetPasswordForEmail,
  signInWithPassword,
  signOut,
  updatePassword,
} from "../src/lib/auth/auth-service";

const USER = { id: "u-1", email: "chef@cafe.rest" };

function mockClient(
  overrides: {
    signIn?: { user?: unknown; error?: unknown } | null;
    signOutError?: unknown;
    getUser?: { user?: unknown; error?: unknown } | null;
    resetError?: unknown;
    updateError?: unknown;
    exchangeSession?: { session?: unknown; error?: unknown } | null;
    profile?: UserProfile | null;
    profileError?: unknown;
  } = {}
): AuthClientLike {
  const profileRow =
    overrides.profile !== undefined
      ? overrides.profile
      : { id: "u-1", is_active: true };
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: profileRow ?? null,
        error: overrides.profileError ?? null,
      });
    },
  };
  return {
    auth: {
      getUser: async () => {
        if (overrides.getUser) return { data: overrides.getUser, error: null };
        return { data: { user: USER }, error: null };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async (credentials: { email: string }) => {
        if (overrides.signIn) return overrides.signIn;
        return {
          data: { user: { id: "u-1", email: credentials.email } },
          error: null,
        };
      },
      signOut: async () => ({ error: overrides.signOutError ?? null }),
      resetPasswordForEmail: async () => ({
        data: {},
        error: overrides.resetError ?? null,
      }),
      updateUser: async (attrs: { password?: string }) => ({
        data: { user: { id: "u-1", ...attrs } },
        error: overrides.updateError ?? null,
      }),
      exchangeCodeForSession: async () => {
        if (overrides.exchangeSession) return overrides.exchangeSession;
        return { data: { session: { user: USER } }, error: null };
      },
    },
    from: () => chain,
  } as unknown as AuthClientLike;
}

const activeProfile: UserProfile = {
  id: "u-1",
  full_name: "Chef",
  phone: null,
  avatar_url: null,
  preferred_locale: "fr",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

test("signInWithPassword returns the user on success", async () => {
  const result = await signInWithPassword(mockClient(), {
    email: "chef@cafe.rest",
    password: "secret",
  });
  assert.equal(result.user?.id, "u-1");
  assert.equal(result.error, null);
});

test("signInWithPassword surfaces errors without a user", async () => {
  const error = {
    message: "Invalid login credentials",
    code: "invalid_credentials",
  };
  const result = await signInWithPassword(
    mockClient({ signIn: { user: null, error } }),
    { email: "x@y.zz", password: "wrong" }
  );
  assert.equal(result.user, null);
  assert.deepEqual(result.error, error);
});

test("signOut returns the raw error", async () => {
  assert.equal((await signOut(mockClient())).error, null);
  const signOutError = { message: "session gone" };
  const result = await signOut(mockClient({ signOutError }));
  assert.deepEqual(result.error, signOutError);
});

test("getCurrentUser resolves the authenticated user", async () => {
  const { user, error } = await getCurrentUser(mockClient());
  assert.equal(user?.id, "u-1");
  assert.equal(error, null);
});

test("getCurrentProfile fetches the profile for the session user", async () => {
  const client = mockClient({ profile: activeProfile });
  const { profile, error } = await getCurrentProfile(client);
  assert.equal(profile?.id, "u-1");
  assert.equal(profile?.is_active, true);
  assert.equal(error, null);
});

test("getCurrentProfile returns null when there is no session user", async () => {
  const client = mockClient({
    getUser: { user: null, error: null },
    profile: activeProfile,
  });
  const { profile, error } = await getCurrentProfile(client);
  assert.equal(profile, null);
  assert.equal(error, null);
});

test("resetPasswordForEmail forwards options", async () => {
  const client = mockClient({
    resetError: null,
  });
  const { error } = await resetPasswordForEmail(client, "chef@cafe.rest", {
    redirectTo: "https://app.cafe.rest/reset-password",
  });
  assert.equal(error, null);
});

test("updatePassword sets the new password", async () => {
  const { user, error } = await updatePassword(mockClient(), "newSecret");
  assert.equal(user?.id, "u-1");
  assert.equal(error, null);
});

test("exchangeCodeForSession returns the session for a valid PKCE code", async () => {
  const { session, error } = await exchangeCodeForSession(
    mockClient(),
    "pkce-code"
  );
  assert.equal(session?.user.id, "u-1");
  assert.equal(error, null);
});

test("exchangeCodeForSession tolerates a null payload", async () => {
  const { session, error } = await exchangeCodeForSession(
    mockClient({ exchangeSession: { session: null, error: null } }),
    "bad-code"
  );
  assert.equal(session, null);
  assert.equal(error, null);
});

test("isProfileActive only accepts active profiles", () => {
  assert.equal(isProfileActive(activeProfile), true);
  assert.equal(isProfileActive({ ...activeProfile, is_active: false }), false);
  assert.equal(isProfileActive(null), false);
  assert.equal(isProfileActive(undefined), false);
});
