# Attribution

Switchboard for dsh is a community port of [Switchboard](https://github.com/Fstrategy/switchboard) by **Lumir**, upstream version 0.1.0, commit `07b07b63fc56add654f62f823fd1e8105fd2c8a8`.

Upstream copyright: **Copyright (c) 2026 Lumir**. The original software is licensed under the [MIT License](<./LICENSE>); the complete upstream copyright, permission and warranty notice is included unchanged.

## Reused work

- [Board logic](<https://github.com/Fstrategy/switchboard/blob/07b07b63fc56add654f62f823fd1e8105fd2c8a8/hooks/logic.ts>), [English/Chinese strings and prompts](<https://github.com/Fstrategy/switchboard/blob/07b07b63fc56add654f62f823fd1e8105fd2c8a8/hooks/i18n.ts>), and [demo fixtures](<https://github.com/Fstrategy/switchboard/blob/07b07b63fc56add654f62f823fd1e8105fd2c8a8/hooks/demo.ts>) are copied byte-for-byte from the upstream commit above.
- [Data contracts](<https://github.com/Fstrategy/switchboard-dsh/blob/v0.1.0/types/index.d.ts>) retain the upstream declarations, with only the final Claude Code module augmentation removed.
- The acceptance scenarios are adapted from upstream [porting documentation](https://github.com/Fstrategy/switchboard/blob/07b07b63fc56add654f62f823fd1e8105fd2c8a8/docs/PORTING.md) and tests. The dsh engine, collector, Host/Client integration and Node test harness are port-specific adaptations.

Original Claude navigation helpers are retained as part of the unchanged pure module, but are not the dsh navigation adapter. Claude Code-specific collectors and registration hooks are not executed by this port.

This community port is not an official DeepSeek/dsh product and does not imply endorsement by Lumir or Anthropic. Upstream Switchboard is itself a community Claude Code plugin, not made or endorsed by Anthropic.
