import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('../../supabase/migrations/20260716213000_phase_d_session_context_fatigue.sql', import.meta.url), 'utf8')

describe('Phase D2 migration contract', () => {
  it('enforces owner-scoped immutable fatigue observations', () => {
    expect(sql).toContain('alter table public.practice_fatigue_checkins enable row level security')
    expect(sql).toContain('(select auth.uid()) = user_id')
    expect(sql).toContain('grant select, insert on table public.practice_fatigue_checkins to authenticated')
    expect(sql).not.toMatch(/grant[^;]*update[^;]*practice_fatigue_checkins/i)
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*practice_fatigue_checkins/i)
  })
})
