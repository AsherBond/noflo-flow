import { Component, IP } from "@noflo/noflo";

/**
 * Like core/Split, except the last attached port gets forwarded packets
 * first.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Like core/Split, expect the last port gets forwarded packets first",
    icon: "expand",
    forwardBrackets: {},
    inPorts: {
      in: { datatype: "all", required: true },
    },
    outPorts: {
      out: {
        datatype: "all",
        addressable: true,
      },
    },
  });

  c.process((input, output) => {
    if (!input.has("in")) {
      return;
    }
    const packet = /** @type {import("@noflo/noflo").IP} */ (input.get("in"));
    const attached = c.outPorts.out.listAttached();
    attached.reverse();
    for (const idx of attached) {
      const ip = new IP(packet.type, packet.data);
      ip.index = idx;
      ip.datatype = packet.datatype;
      ip.schema = packet.schema;
      ip.clonable = packet.clonable;
      output.send({
        out: ip,
      });
    }
    output.done();
  });

  return c;
}
