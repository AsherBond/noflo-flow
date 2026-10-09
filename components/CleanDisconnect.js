import { Component, IP } from "@noflo/noflo";

/**
 * Re-emits each complete stream received on an `in` connection as a
 * distinct stream on the corresponding `out` connection index, with no
 * overlapping.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "when several streams are nested through the array in-port (i.e. a connect through one of the ports before there is a disconnect), separate the streams into distinct streams with no overlapping",
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

  c.process((input, output) => {
    const indexesWithStreams = /** @type {number[]} */ (
      input.attached("in")
    ).filter((idx) => input.hasStream(["in", idx]));
    if (!indexesWithStreams.length) {
      return;
    }
    for (const idx of indexesWithStreams) {
      const stream = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream(["in", idx])
      );
      for (const packet of stream) {
        // 1.x sent an IP-like plain object; construct a real IP carrying
        // the target connection index
        const ip = new IP(packet.type, packet.data);
        ip.index = idx;
        ip.datatype = packet.datatype;
        ip.schema = packet.schema;
        ip.clonable = packet.clonable;
        output.send({
          out: ip,
        });
      }
    }
    output.done();
  });

  return c;
}
