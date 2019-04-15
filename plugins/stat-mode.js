module.exports = Mode

function Mode(stat) {
  if (!(this instanceof Mode)) return new Mode(stat)
  if (!stat) throw new TypeError('must pass in a "stat" object')
  if (typeof stat.mode !== 'number') stat.mode = 0
  this.stat = stat
}

Mode.prototype.toOctal = function() {
  const octal = this.stat.mode & 4095 /* 07777 */
  return ('0000' + octal.toString(8)).slice(-4)
}
