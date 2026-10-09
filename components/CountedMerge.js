import { Component } from "@noflo/noflo";

/**
 * Like core/Merge, but merges up to a specified number of streams:
 * streams up to the threshold are forwarded, later ones dropped.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Like 'core/Merge', but merge up to a specified number of streams.",
    forwardBrackets: {},
    inPorts: {
      in: {
        datatype: "all",
        description: "IP to merge",
        required: true,
      },
      threshold: {
        datatype: "int",
        control: true,
        default: 1,
      },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  let received = 0;
  c.tearDown = async () => {
    received = 0;
  };

  c.process((input, output) => {
    if (!input.hasStream("in")) {
      return;
    }
    if (input.attached("threshold").length && !input.hasData("threshold")) {
      return;
    }
    let threshold = 1;
    if (input.hasData("threshold")) {
      threshold = input.getData("threshold");
    }
    const packets = /** @type {import("@noflo/noflo").IP[]} */ (
      input.getStream("in")
    );
    if (received < threshold) {
      // We can still send
      for (const packet of packets) {
        output.send({ out: packet });
      }
    } else {
      // Over threshold, drop packets
      for (const packet of packets) {
        packet.drop();
      }
    }
    received += 1;
    output.done();
  });

  return c;
}
