# @noflo/flow

Flow Control for [NoFlo](http://noflojs.org/)

This package provides utility components for flow-control patterns in
NoFlo programs: gating, throttling, joining, racing, and collecting
streams.

## Usage

Install the package:

    npm install @noflo/flow

The components are then available under the `flow/` namespace, for
example `flow/Gate` or `flow/CollectUntilIdle`.

Components include:

- `Accept`, `Deny`, `Gate`, `HasGroup` — filter and route streams
- `All`, `Race`, `Concat`, `Collate`, `Merge`-style combining via
  `CountedMerge` — combine results from multiple connections
- `CollectUntilIdle`, `Stop`, `CountDown` — buffering and timing
- `CleanSplit`, `CleanDisconnect`, `Fork`, `ReverseSplit`, `Reorder` —
  stream splitting and reordering
- `Throttle` — load-based throttling
- `Watchdog` — deadman switch emitting when a stream stays silent
