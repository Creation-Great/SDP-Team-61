# Changelog

## v1.3.1
- DB: Integrated explicit RLS write policies into migrations (INSERT/UPDATE paths).
- Version: package.json bumped to 0.1.3-1 (v1.3.1).
- Upgrade: sql/upgrade-from-v1.3-to-v1.3.1.sql provided.

## v1.3
- Feature: /assign revives canceled pairs to pending.
- DB: assignment_status ENUM; added indexes; SECURITY DEFINER refresh function.
