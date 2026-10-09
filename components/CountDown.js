import { Component, IP } from "@noflo/noflo";

/**
 * Counts down from a number (default 1) as bangs arrive on `in`, and
 * sends an empty data IP when the count reaches zero. Repeats by
 * default.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "count down from particular number, by default 1, and send an empty IP when it hits 0",
    inPorts: {
      in: {
        datatype: "bang",
        description: "IPs to decrease the count down",
        required: true,
      },
      count: {
        datatype: "int",
        description: "Count down starting number",
        default: 1,
        control: true,
      },
      repeat: {
        datatype: "boolean",
        description: "Repeat the count down mechanism if true",
        default: true,
        control: true,
      },
    },
    outPorts: {
      out: {
        datatype: "bang",
        description: "IP emitted when the count reach 0",
      },
      count: {
        datatype: "int",
        description: "Number of packets received in this cycle",
      },
    },
  });

  let received = 0;
  c.tearDown = async () => {
    received = 0;
  };

  c.process((input, output) => {
    if (!input.hasData("in")) {
      return;
    }
    if (input.attached("count").length && !input.hasData("count")) {
      return;
    }
    if (input.attached("repeat").length && !input.hasData("repeat")) {
      return;
    }
    let count = 1;
    if (input.hasData("count")) {
      count = input.getData("count");
    }
    let repeat = true;
    if (input.hasData("repeat")) {
      repeat = input.getData("repeat");
    }
    input.getData("in");
    received += 1;
    output.send({ count: received });
    if (received === count) {
      output.send({ out: new IP("data", null) });
      if (repeat) {
        received = 0;
      }
    }
    output.done();
  });

  return c;
}
