# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2026-06-22

### Changed
- Directory layout section in README is now collapsed under a `<details>` toggle

## [0.1.6] - 2026-06-22

### Added
- Colorized ASCII art banner displayed on every `npx ace-agents` invocation

## [0.1.5] - 2026-06-22

### Fixed
- Root `README.md` CLI examples now use `npx ace-agents@latest` (was missed in v0.1.4 which only fixed `ace/README.md`)

## [0.1.4] - 2026-06-22

### Fixed
- All CLI examples in README now use `npx ace-agents@latest` instead of the bare `ace` command, which is not available without a global install

## [0.1.3] - 2026-06-10

### Added
- Example workflows section in README (explicit agent calls, auto-routing, multi-agent handoff, lite mode, hotfix mode)

### Fixed
- README install section now shows `npx`-only usage; removed global install option

## [0.1.2] - 2026-06-03

### Changed
- CI opts into Node.js 24 ahead of forced migration

## [0.1.1] - 2026-05-27

### Added
- Initial public release
