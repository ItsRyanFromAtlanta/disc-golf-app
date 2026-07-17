import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('../../supabase/migrations/20260716220000_phase_d3_goal_report_contracts.sql', import.meta.url), 'utf8')

describe('Phase D3 checkpoint-1 migration contract', () => {
  it('enables owner-scoped RLS and indexes every owner column', () => {
    for (const table of ['notification_preferences', 'goals', 'goal_events', 'weekly_report_snapshots']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
    expect(sql.match(/\(select auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(7)
    expect(sql).toContain('goals_user_status_idx')
    expect(sql).toContain('goal_events_user_recorded_idx')
    expect(sql).toContain('weekly_reports_user_window_idx')
  })

  it('keeps events and reports immutable to ordinary clients', () => {
    expect(sql).toContain('grant select on table public.goals, public.goal_events to authenticated')
    expect(sql).toContain('grant select, insert on table public.weekly_report_snapshots to authenticated')
    expect(sql).not.toMatch(/grant[^;]*update[^;]*(goal_events|weekly_report_snapshots)/i)
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*(goal_events|weekly_report_snapshots)/i)
  })

  it('uses owner-checked atomic goal functions and private definer boundaries', () => {
    expect(sql).toContain("v_user_id uuid := auth.uid()")
    expect(sql).toContain("message = 'version_conflict'")
    expect(sql).toContain('security definer set search_path = \'\'')
    expect(sql).toContain('revoke all on function private.goal_transition')
  })
})
