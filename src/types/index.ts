import type { Database } from "./database";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T] extends {
    Row: infer R;
  }
    ? R
    : never;

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T] extends {
    Insert: infer I;
  }
    ? I
    : never;

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T] extends {
    Update: infer U;
  }
    ? U
    : never;
