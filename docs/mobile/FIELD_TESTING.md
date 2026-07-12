# Field Testing

Test representative iPhone and Android sizes plus at least one older/lower-powered device.

- Direct sunlight and low-light legibility; wet/gloved one-thumb operation where safe.
- Cold start to first action, tab resume, app background/termination, and interrupted activity restore.
- Airplane mode, weak/transitioning networks, duplicate retries, and visible outbox recovery.
- Large text, screen reader, Voice Control/keyboard, reduced motion, contrast, and orientation.
- Camera/photo permission denied/limited/granted; storage pressure and failed uploads.
- Battery use, thermal behavior, long sessions, device clock/time-zone change, and Monday–Sunday reports.

Record device/OS/build, scenario, expected/actual result, logs without PII, and whether the issue blocks
release. Field findings become tests or backlog entries rather than living only in chat.
