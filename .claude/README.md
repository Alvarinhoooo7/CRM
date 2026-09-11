# Configuración de Claude Code para este proyecto

Todo lo de esta carpeta viaja con el repo: al clonarlo en cualquier equipo,
Claude Code levanta con los mismos plugins y skills. **No hace falta ningún
paso manual de instalación.**

## `settings.json` — plugins

Declara 10 plugins del marketplace oficial (`claude-plugins-official`, incluido
por defecto en Claude Code). Se habilitan solos al abrir el proyecto:

`superpowers` · `feature-dev` · `skill-creator` · `claude-md-management` ·
`code-review` · `code-simplifier` · `frontend-design` · `context7` ·
`security-guidance` · `claude-security`

Quedaron fuera a propósito: `typescript-lsp` y `kotlin-lsp` (acá no hay TS ni
Kotlin), `playwright` (la web app vive en Apps Script y hay que desplegarla para
probarla) y `github` (requiere OAuth propio por equipo).

## `skills/` — 12 skills de ingeniería

Copiadas de [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(licencia MIT). Cubren TDD, spec-driven development, planificación, debugging,
hardening, revisión de código, ADRs, diseño de APIs, performance, UI y flujo git.

Para actualizarlas:

```bash
git clone --depth 1 https://github.com/addyosmani/agent-skills /tmp/as
cp -r /tmp/as/skills/<nombre>/ .claude/skills/<nombre>/
```

Se excluyó `webapp-testing` de `anthropics/skills` porque ese repo no declara
licencia y no corresponde vendorizarlo acá.

## Lo que NO viaja con el repo

Es específico de cada equipo y hay que configurarlo aparte:

- **MCP de Obsidian** — la ruta al vault cambia en cada máquina:
  `claude mcp add obsidian --scope user -- npx -y obsidian-mcp "/ruta/a/tu/vault"`
- **MCP de GitHub** — necesita su propio OAuth: `/mcp`
- **`apps-script/.clasp.json`** — contiene el `scriptId`, está en `.gitignore`
