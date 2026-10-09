import { Component, IP } from "@noflo/noflo";

/**
 * When the matching number of `in` connections have received streams,
 * sends them to the `out` connection indexes in reverse order. Streams
 * are recorded as they complete, so a slow connection cannot deadlock
 * already-received ones.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Send packets in to outport indexes in reverse order when matching number of inport indexes have received data to attached outports",
    forwardBrackets: {},
    inPorts: {
      in: { datatype: "all", addressable: true, required: true },
    },
    outPorts: {
      out: {
        datatype: "all",
        addressable: true,
      },
    },
  });

  /** @type {Map<string, Map<number, import("@noflo/noflo").IP[]>>} */
  const recorded = new Map();
  c.tearDown = async () => {
    recorded.clear();
  };

  c.process((input, output) => {
    const attached = /** @type {number[]} */ (input.attached("in"));
    const key = input.scope ?? "null";
    let scopeStreams = recorded.get(key);
    if (!scopeStreams) {
      scopeStreams = new Map();
      recorded.set(key, scopeStreams);
    }

    let outAttached = c.outPorts.out.listAttached().slice(0);
    let expectedStreams = outAttached.length;
    if (attached.length < outAttached.length) {
      // Fewer attached inputs than outputs, use their number
      expectedStreams = attached.length;
      outAttached = outAttached.slice(0, expectedStreams);
    }

    // Record any newly completed streams
    for (const idx of attached) {
      if (scopeStreams.has(idx)) {
        continue;
      }
      if (!input.hasStream(["in", idx])) {
        continue;
      }
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream(["in", idx])
      );
      scopeStreams.set(idx, stream);
    }

    // Wait until enough streams have arrived
    const available = attached.filter((idx) => scopeStreams.has(idx));
    if (available.length < expectedStreams) {
      return;
    }

    /** @type {import("@noflo/noflo").IP[][]} */
    const streams = available
      .sort((a, b) => a - b)
      .map(
        (idx) =>
          /** @type {import("@noflo/noflo").IP[]} */ (scopeStreams.get(idx)),
      );
    const targets = outAttached.slice(0, streams.length).reverse();
    for (let i = 0; i < targets.length; i += 1) {
      const stream = streams[i];
      const outIdx = targets[i];
      for (const packet of stream) {
        const ip = new IP(packet.type, packet.data);
        ip.index = outIdx;
        ip.datatype = packet.datatype;
        ip.schema = packet.schema;
        ip.clonable = packet.clonable;
        output.send({ out: ip });
      }
    }
    // Reset the scope for the next round
    recorded.delete(key);
    output.done();
  });

  return c;
}
