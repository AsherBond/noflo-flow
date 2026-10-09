import { Component } from "@noflo/noflo";

/**
 * Buffers everything received until a bang arrives on `ready`, then
 * releases all stored IPs at once. Keeps the 1.x default bracket
 * forwarding (the 1.x source's `forwardBracets` typo meant forwarding
 * was never disabled).
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Stop everything that's received and send out once we're told that we're ready to send.",
    icon: "stop-circle",
    inPorts: {
      in: {
        datatype: "all",
        description: "IPs to buffer until an IP arrives on the ready port",
        required: true,
      },
      ready: {
        datatype: "bang",
        description: "Trigger the emission of all the stored IPs",
      },
    },
    outPorts: {
      out: {
        datatype: "all",
        description: "IPs forwarded from the in port",
      },
    },
  });

  c.process((input, output) => {
    if (!input.hasData("ready", "in")) {
      return;
    }
    input.getData("ready");
    /** @type {import("@noflo/noflo").IP[]} */
    const packets = [];
    while (input.has("in")) {
      packets.push(/** @type {import("@noflo/noflo").IP} */ (input.get("in")));
    }
    for (const packet of packets) {
      output.send({ out: packet });
    }
    output.done();
  });

  return c;
}
