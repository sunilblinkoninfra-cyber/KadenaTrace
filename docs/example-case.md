# Demo traced cases

## Shadow Router Laundering Pattern (original fixture)
- Seed wallet: `0x1111111111111111111111111111111111111111`
- Seed tx: `0x1000000000000000000000000000000000000000000000000000000000000001`
- Chains: Ethereum, BSC
- Risk signals: fan-out burst, rapid multi-hop, mixer interaction, cross-chain bridge, sink consolidation into exchange deposit
- Case slug: `shadow-router-laundering-demo`

## Nomad Bridge Exploit Pattern (second fixture)
- Seed wallet: `0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01`
- Chains: Ethereum, BSC
- Risk signals: fan-out to 5 copy-exploiters, rapid hops, mixer touchpoint, bridge to BSC, sink consolidation into exchange
- Case slug: `nomad-bridge-exploit-demo`
- Basis: Structural recreation of the August 2022 Nomad bridge exploit pattern (publicly documented, fictional addresses)

Both cases are pre-seeded by the API at startup and are accessible at /case/{slug}. No API keys are required.
