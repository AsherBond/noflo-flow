import { Component, IP } from "@noflo/noflo";

/**
 * Collates two or more object streams, sorted by the configured control
 * fields, and sends them in collated order inside group brackets per
 * field value.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Collate two or more streams, based on a list of control field lengths",
    icon: "sort-amount-asc",
    forwardBrackets: {},
    inPorts: {
      ctlfields: {
        datatype: "string",
        description: "Comma-separated list of object keys to collate by",
        control: true,
        required: true,
      },
      in: {
        description: "Objects to collate",
        datatype: "object",
        addressable: true,
        required: true,
      },
    },
    outPorts: {
      out: {
        description: "Objects in collated order",
        datatype: "object",
      },
    },
  });

  // Comparison of a single control field
  /**
   * @param {unknown} left
   * @param {unknown} right
   * @returns {number}
   */
  const sort = (left, right) => {
    // Lowercase strings so they always sort correctly
    let l = left;
    let r = right;
    if (typeof l === "string") {
      l = l.toLowerCase();
    }
    if (typeof r === "string") {
      r = r.toLowerCase();
    }

    if (l === r) {
      return 0;
    }
    if (/** @type {string|number} */ (l) > /** @type {string|number} */ (r)) {
      return 1;
    }
    return -1;
  };

  /**
   * The actual collation algorithm, returns a closure with the control
   * fields that can be used with Array.prototype.sort()
   * @param {string[]} fields
   * @param {import("@noflo/noflo").IP[]} original
   * @param {import("@noflo/noflo").IP} a
   * @param {import("@noflo/noflo").IP} b
   * @returns {number}
   */
  const sortByControlFields = (fields, original, a, b) => {
    // If there are no control fields specified we can't sort
    if (!fields.length) {
      return 0;
    }

    // Traverse the fields until you find one to sort by
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i];
      const order = sort(
        /** @type {Record<string, unknown>} */ (a.data)[field],
        /** @type {Record<string, unknown>} */ (b.data)[field],
      );
      if (order !== 0) {
        return order;
      }
    }

    // All fields were the same, send in order of appearance
    if (original.indexOf(a) < original.indexOf(b)) {
      return -1;
    }
    return 1;
  };

  /**
   * Sending the collated objects to the output port together with
   * bracket IPs
   * @param {import("@noflo/noflo").IP[]} packets
   * @param {string[]} fields
   * @param {{ send(map: Record<string, unknown>): void }} output
   */
  const sendWithGroups = (packets, fields, output) => {
    /** @type {import("@noflo/noflo").IP|null} */
    let previous = null;
    for (const packet of packets) {
      // For the first packet send a bracket IP for each control field
      for (const field of fields) {
        if (previous) {
          continue;
        }
        output.send({ out: new IP("openBracket", field) });
      }

      // For subsequent packets send ending and opening brackets for
      // fields that are different
      if (previous) {
        for (let idx = 0; idx < fields.length; idx += 1) {
          const field = fields[idx];
          if (
            /** @type {Record<string, unknown>} */ (packet.data)[field] !==
            /** @type {Record<string, unknown>} */ (previous.data)[field]
          ) {
            // Differing field found, close this bracket and all
            // following ones
            const differing = fields.slice(idx);
            const closes = differing.slice(0);
            closes.reverse();
            for (const f of closes) {
              output.send({ out: new IP("closeBracket", f) });
            }
            for (const f of differing) {
              output.send({ out: new IP("openBracket", f) });
            }
            break;
          }
        }
      }

      // Send it out
      output.send({ out: packet });

      // Provide for comparison to the next one
      previous = packet;
    }

    // Last packet sent, send closing brackets
    const closes = fields.slice(0);
    closes.reverse();
    for (const field of closes) {
      output.send({ out: new IP("closeBracket", field) });
    }
  };

  c.process((input, output) => {
    // We want to have a list of fields to collate by
    if (!input.hasData("ctlfields")) {
      return;
    }
    // To be able to sort everything we must wait until we have all the data
    if (!input.attached("in").length) {
      return;
    }
    const attached = /** @type {number[]} */ (input.attached("in"));
    const indexesWithStreams = attached.filter((idx) =>
      input.hasStream(["in", idx]),
    );
    if (indexesWithStreams.length !== attached.length) {
      return;
    }

    let fields = input.getData("ctlfields");
    if (typeof fields === "string") {
      fields = fields.split(",");
    }

    // Receive the packets
    /** @type {import("@noflo/noflo").IP[]} */
    let packets = [];
    for (const idx of indexesWithStreams) {
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream(["in", idx])
      ).filter((ip) => ip.type === "data");
      packets = packets.concat(stream);
    }
    // Sort them by control fields if there are any
    const original = packets.slice(0);
    packets.sort((a, b) => sortByControlFields(fields, original, a, b));
    output.send({ out: new IP("openBracket", null) });
    // Send them out
    sendWithGroups(packets, fields, output);
    // Send end-of-transmission
    output.send({ out: new IP("closeBracket", null) });
    output.done();
  });

  return c;
}
