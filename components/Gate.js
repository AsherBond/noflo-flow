/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const noflo = require('noflo');

exports.getComponent = function() {
  const c = new noflo.Component;
  c.description = 'Forward packets only when the gate is open';
  c.icon = 'pause';
  c.inPorts.add('in',
    {datatype: 'all'});
  c.inPorts.add('open', {
    datatype: 'bang',
    description: 'Send one IP to open the gate'
  }
  );
  c.inPorts.add('close', {
    datatype: 'bang',
    description: 'Send one IP to close the gate'
  }
  );
  c.outPorts.add('out',
    {datatype: 'all'});
  c.isOpen = false;
  c.tearDown = function(callback) {
    c.isOpen = false;
    c.icon = 'pause';
    return callback();
  };
  c.forwardBrackets = {};
  return c.process(function(input, output) {
    if (input.hasData('open')) {
      input.getData('open');
      c.isOpen = true;
      c.setIcon('play');
      output.done();
      return;
    }
    if (input.hasData('close')) {
      input.getData('close');
      c.isOpen = false;
      c.setIcon('pause');
      output.done();
      return;
    }
    if (!input.has('in')) { return; }
    const packet = input.get('in');
    if (!c.isOpen) {
      packet.drop();
      output.done();
      return;
    }
    return output.sendDone({
      out: packet});
  });
};
