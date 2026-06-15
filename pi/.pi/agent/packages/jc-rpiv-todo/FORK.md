# jc-rpiv-todo

Local JC fork of `@juicesharp/rpiv-todo`.

- Upstream package copied from: `/home/jc/.pi/agent/npm/node_modules/@juicesharp/rpiv-todo`
- Upstream version: `1.19.1`
- Local package version: `1.19.1-jc.1`
- Active package path: `/home/jc/.pi/agent/packages/jc-rpiv-todo`
- Active config remains: `/home/jc/.config/rpiv-todo/config.json`

Current intent: keep the todo tool/overlay durable across npm package updates while allowing local visual patches.

Local patches:

- Todo overlay renders one blank spacer row above and below the panel.
- `config.ts` vendors the small `rpiv-config` helpers it uses, so the local fork does not depend on the upstream sibling package for runtime config loading.

The upstream npm package may remain installed under `~/.pi/agent/npm/node_modules` as source/cache, but it is not active unless `settings.json.packages` includes `npm:@juicesharp/rpiv-todo` again.
