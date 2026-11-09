export interface LeaderboardEntry {
  id: string;
  name: string;
  origin: string;
  whatsapp?: string;
  level: number;
  duration_seconds: number;
  created_at?: string;
}

export interface EntryInput {
  name: string;
  origin: string;
  whatsapp?: string;
  level: number | string;
  duration_seconds: number | string;
  id?: string;
}

export type ParseResult =
  | { entry: LeaderboardEntry; error?: never }
  | { error: string; entry?: never };
