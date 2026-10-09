import { Component, IP } from "@noflo/noflo";

/**
 * Gathers data from all incoming connections and sends them together in
 * order of connection, once every connected connection has sent a
 * complete stream. Streams are recorded as they complete, so a slow
 * connection cannot deadlock already-received ones.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Gathers data from all incoming connections and sends them together in order of connection",
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
  const results = new Map();
  c.tearDown = async () => {
    results.clear();
  };

  c.process((input, output) => {
    const attached = /** @type {number[]} */ (input.attached("in"));
    const key = input.scope ?? "null";
    let scopeResults = results.get(key);
    if (!scopeResults) {
      scopeResults = new Map();
      results.set(key, scopeResults);
    }

    // Record any newly completed streams
    for (const idx of attached) {
      if (scopeResults.has(idx)) {
        continue;
      }
      if (!input.hasStream(["in", idx])) {
        continue;
      }
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream(["in", idx])
      );
      scopeResults.set(idx, stream);
    }

    // Wait until every attached connection has delivered a stream
    if (attached.some((idx) => !scopeResults.has(idx))) {
      return;
    }

    for (const idx of attached) {
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        scopeResults.get(idx)
      );
      for (const packet of stream) {
        // 1.x sent an IP-like plain object; construct a real IP carrying
        // the source connection index
        const ip = new IP(packet.type, packet.data);
        ip.index = idx;
        ip.datatype = packet.datatype;
        ip.schema = packet.schema;
        ip.clonable = packet.clonable;
        output.send({ out: ip });
      }
    }
    // Reset the scope for the next round
    results.delete(key);
    output.done();
  });

  return c;
}
