import { Component } from "@noflo/noflo";

/**
 * Waits for a result stream from every connected `in` connection and
 * sends all of them as an array, like Promise.all. An `error` IP rejects
 * the whole scope.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Like Promise.all, wait for result from all connected inputs and send them or an error out",
    icon: "compress",
    forwardBrackets: {},
    inPorts: {
      in: { datatype: "all", addressable: true, required: true },
      error: { datatype: "object" },
    },
    outPorts: {
      out: { datatype: "array" },
      error: { datatype: "object" },
    },
  });

  /**
   * @typedef {Object} PendingScope
   * @property {Record<number, import("@noflo/noflo").IP[]>} results
   * @property {boolean} resolved
   * @property {boolean} rejected
   */

  /** @type {Map<string, PendingScope>} */
  const pending = new Map();
  /**
   * @param {string|null} scope
   * @returns {PendingScope}
   */
  const prepareScope = (scope) => {
    const key = scope ?? "null";
    let state = pending.get(key);
    if (!state) {
      state = { results: {}, resolved: false, rejected: false };
      pending.set(key, state);
    }
    return state;
  };
  c.tearDown = async () => {
    pending.clear();
  };

  c.process((input, output) => {
    if (input.hasData("error")) {
      // There is a failure in this scope, reject it
      const err = input.getData("error");
      const state = prepareScope(input.scope);
      if (state.rejected || state.resolved) {
        // This scope was already resolved
        output.done();
        return;
      }
      // Mark scope as rejected
      state.rejected = true;
      // Drop any results since something failed
      state.results = {};
      output.sendDone({ error: err });
      return;
    }

    // See if we have any input results
    const indexesWithStreams = /** @type {number[]} */ (
      input.attached("in")
    ).filter((idx) => input.hasStream(["in", idx]));
    if (!indexesWithStreams.length) {
      return;
    }

    const state = prepareScope(input.scope);

    // Check if the execution was already resolved
    if (state.rejected || state.resolved) {
      for (const idx of indexesWithStreams) {
        // Drop all packets that arrive after resolution
        const stream = /** @type {import("@noflo/noflo").IP[]} */ (
          input.getStream(["in", idx])
        );
        for (const ip of stream) {
          ip.drop();
        }
      }
      output.done();
      return;
    }

    // Read results
    for (const idx of indexesWithStreams) {
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream(["in", idx])
      ).filter((ip) => ip.type === "data");
      // If this connection already sent, disregard the new stream
      if (state.results[idx]) {
        continue;
      }
      state.results[idx] = stream;
    }

    // Check if we have all results
    const attached = /** @type {number[]} */ (input.attached("in"));
    for (const idx of attached) {
      if (!state.results[idx]?.length) {
        // Still waiting
        output.done();
        return;
      }
    }

    // Mark as resolved
    state.resolved = true;
    // Send data
    const resultData = attached.map((idx) =>
      (state.results[idx] ?? []).map((ip) => ip.data),
    );
    output.sendDone({ out: resultData });
    // Clean packets
    state.results = {};
  });

  return c;
}
