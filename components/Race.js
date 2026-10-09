import { Component } from "@noflo/noflo";

/**
 * Like Promise.race: sends the first result stream from the connected
 * `in` connections, or an `error` if one arrives first. Later streams
 * are dropped.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Like Promise.race, wait for result from all connected inputs and send first result or an error out",
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
      state = { resolved: false, rejected: false };
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
    const results = /** @type {import("@noflo/noflo").IP[]} */ (
      input.getStream(["in", indexesWithStreams[0]])
    ).filter((ip) => ip.type === "data");

    // Mark as resolved
    state.resolved = true;
    // Send data
    const data = results.map((ip) => ip.data);
    output.sendDone({ out: data });
  });

  return c;
}
