# Documentation index

Use this map only when task-specific guidance is needed. Follow a known link
instead when possible, read the applicable section, and expand only as needed.
Source/configuration owns implementation details; references explain decisions
and standards. None of these links automatically imports another file.

| Document | When to read / purpose |
| --- | --- |
| [Architecture](architecture.md) | Changing routes, rendering, stores, playback or archive data boundaries; static-first decisions and current flow. |
| [TypeScript](typescript.md) | Implementing/refactoring TypeScript or component contracts; types, state, validation, imports and accessible labels. |
| [CSS](css.md) | Changing styles/layout; shared tokens, allowed breakpoints and responsive behavior. |
| [Testing](testing.md) | Changing behavior/tests or selecting handoff checks; commands, test placement and targeted browser regressions. |
| [Development workflow](development-workflow.md) | Starting development, managing hooks or persistent multi-step plans. |
| [Deployment](deployment.md) | Changing hosting/build configuration or base-path URLs; GitHub Pages and production checks. |
| [SHOWS design](shows-ui-guideline.md) | Changing SHOWS presentation/search/filter behavior; observed design evidence and unimplemented proposals, not current code contracts. |

There is no database or server runtime in this repository. Archive JSON
integration belongs to Architecture and the validators in `src/utils/`;
database schemas belong to the backend, not a new site database guide.

Temporary multi-step work uses `docs/plans/<task>.md` only when useful; see the
workflow. Historical files in `docs/plans/archive/` are not routine references
and are intentionally not individually listed here.

`docs/human/` contains human-maintained notes; it is outside agent standards
and should not be changed as part of documentation maintenance.
