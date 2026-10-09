import { Component, IP } from "@noflo/noflo";

/**
 * Directs incoming IPs to the `out` connection indexes named on the
 * `port` port. Acts as a Split (sending to every attached connection)
 * when no port indexes have been set.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Send the port number to 'PORT' to set where to direct IPs. It acts as a 'Split' by default, sending IPs to every out-port.",
    inPorts: {
      in: {
        datatype: "all",
        description: "IPs to forward",
        required: true,
      },
      port: {
        datatype: "number",
        description: "Number of ports to forward IPs to",
      },
    },
    outPorts: {
      out: {
        datatype: "all",
        addressable: true,
      },
    },
  });

  /** @type {number[]} */
  let indexes = [];
  c.tearDown = async () => {
    indexes = [];
  };

  c.process((input, output) => {
    if (input.hasStream("port")) {
      // New set of port indexes to work with
      const ports = /** @type {import("@noflo/noflo").IP[]} */ (
        input.getStream("port")
      ).filter((ip) => ip.type === "data");
      indexes = [];
      for (const port of ports) {
        const index = Number.parseInt(port.data, 10);
        if (indexes.includes(index)) {
          continue;
        }
        indexes.push(index);
      }
      output.done();
      return;
    }
    if (!input.hasData("in")) {
      return;
    }
    const data = input.getData("in");
    const targets =
      indexes.length === 0 ? c.outPorts.out.listAttached() : indexes.slice(0);
    for (const idx of targets) {
      output.send({
        out: new IP("data", data, { index: idx }),
      });
    }
    output.done();
  });

  return c;
}
