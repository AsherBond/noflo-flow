import { Component } from "@noflo/noflo";

/**
 * Like core/Split, but only begins sending at the end of a stream: the
 * complete stream is buffered and re-emitted at once.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "Like core/Split, but only begins sending at end of a stream",
    icon: "expand",
    forwardBrackets: {},
    inPorts: {
      in: { datatype: "all", required: true },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  c.process((input, output) => {
    if (!input.hasStream("in")) {
      return;
    }
    const stream = /** @type {import("@noflo/noflo").IP[]} */ (
      input.getStream("in")
    );
    for (const packet of stream) {
      output.send({ out: packet });
    }
    output.done();
  });

  return c;
}
