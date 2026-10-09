# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [2.0.0-alpha.1] - 2026-10-09

### Added

- The package is renamed to `@noflo/flow`; graph component identifiers are unaffected and keep resolving under the `flow/` namespace
- New `Watchdog` component: a deadman switch that emits a bang when a configured interval elapses without any input. It is the component-level bridge for asserting stream silence in tests while the fbp-spec runner `absent` expectation remains deferred

### Changed

- All 18 components are converted to JavaScript ES modules for NoFlo 2.x (esm-only), with TypeScript-checked sources and Biome formatting
- Components follow the 2.x Process API contract: preconditions are checked with `has`/`hasData`/`hasStream` before any `get`/`getData` call, and per-scope state is kept in Maps cleared in async `tearDown`
- `Concat` and `Reorder` record completed streams per connection instead of requiring all streams to be buffered at once, so a slow connection can no longer deadlock already-received ones (the 1.x implementation depended on legacy connection-state semantics)
- `CleanDisconnect` and `Concat` declare their `out` port addressable and send real IPs carrying the connection index; the 1.x versions sent IP-like plain objects through a non-addressable port
- `Accept` and `Deny` no longer crash when data arrives before any accept/deny value: a missing list is treated as accepting nothing (`Accept`) or denying nothing (`Deny`), instead of throwing a TypeError
- The Karma/webpack browser test infrastructure is dropped; the components are runtime-agnostic ES modules

### Fixed

- Test suite rebuilt on `@noflo/fbp-spec-runner` (fbp-spec YAML cases) and `node:test` (35 tests), replacing the Mocha/Karma setup
