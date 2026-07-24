# Security

## Reporting

Report suspected vulnerabilities in these skills through a GitHub issue, or
privately to the maintainers if the report itself would disclose a live secret.

## Trust boundary for skill commands

Several skills instruct an agent to run a package straight from npm:

| Command | Owner | Pinning |
| --- | --- | --- |
| `npx @agent-native/skills@latest add …` | Builder.io | unpinned |
| `npx @agent-native/core@latest …` | Builder.io | unpinned |
| `npx -y ccusage@20 blocks --active --json` | third party | major pinned |

`npx` downloads and executes the resolved version, so following a skill means
executing whatever that package publishes at the moment it runs. A compromise of
a package or a maintainer account reaches every agent that follows the skill.

`ccusage` is pinned to its current major because it is outside Builder's
control, so an unrelated major release cannot change what the command does.

The `@agent-native/*` packages stay on `@latest` deliberately. Both are
pre-1.0 (`0.x`), where a minor bump is allowed to break, so a major pin buys no
semver guarantee, and an exact pin goes stale within days at their release
cadence. They are first-party: installing them is the same trust decision as
installing these skills.

If your environment cannot accept that, vendor the skills and pin the packages
to exact versions you have reviewed, or run the commands in a sandbox.

## Reviewing skill content

Skill Markdown is executable instruction, not inert documentation. An agent
follows it. When reviewing a change to a skill, read it as you would read code:

- Instructions that send repo content to a network destination.
- Instructions that read credentials, `.env` files, or private data.
- Invisible or bidirectional Unicode, which can hide text from a human reviewer
  while the model still reads it.
- Commands run with `--yes`, `-y`, or otherwise without confirmation.

## Secrets in generated content

The visual plan and recap skills build hosted documents out of real diffs, so a
credential left in a diff can leave the machine. Redact before publishing, and
use `--mode local-files` for any diff that touches credentials.
